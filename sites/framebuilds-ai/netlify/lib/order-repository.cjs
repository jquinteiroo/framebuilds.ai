'use strict';
const { randomUUID } = require('node:crypto');
function createOrderRepository(pool) {
  const one = async (sql, args = []) => (await pool.query(sql, args)).rows[0] || null;
  return {
    async ready() { await pool.query('SELECT id FROM commerce_orders LIMIT 0'); return true; },
    async ensureOrder(input) {
      const id = randomUUID();
      await pool.query(`INSERT INTO commerce_orders (id, mode, attempt_id, package_id, amount_cents, currency, seller_id, reference, asset)
        VALUES ($1,$2,$3,$4,$5,'BRL',$6,$7,$8::jsonb) ON CONFLICT (mode, attempt_id) DO NOTHING`,
      [id, input.mode, input.attemptId, input.packageId, input.priceCents, input.sellerId, 'fb_' + id, JSON.stringify(input.asset)]);
      const order = await one('SELECT * FROM commerce_orders WHERE mode=$1 AND attempt_id=$2', [input.mode, input.attemptId]);
      if (!order || order.package_id !== input.packageId || order.seller_id !== input.sellerId) throw new Error('ATTEMPT_CONFLICT');
      // Price and file version are snapshots of the original attempt, even if the
      // catalogue changes before the buyer retries.
      return order;
    },
    getOrder: id => one('SELECT * FROM commerce_orders WHERE id=$1', [id]),
    findOrder: reference => one('SELECT * FROM commerce_orders WHERE reference=$1', [reference]),
    async approvedPayments(id) { return (await pool.query("SELECT id FROM commerce_payments WHERE order_id=$1 AND status='approved' ORDER BY provider_updated_at DESC", [id])).rows; },
    async claimCheckout(id) {
      return one(`UPDATE commerce_orders SET checkout_state='creating',checkout_lease=$2,checkout_lease_until=now()+interval '45 seconds'
        WHERE id=$1 AND checkout_state='new' RETURNING *`, [id, randomUUID()]);
    },
    async savePreference(id, lease, preferenceId, checkoutUrl) {
      const order = await one(`UPDATE commerce_orders SET checkout_state='ready',preference_id=$3,checkout_url=$4,
        checkout_lease_until=NULL WHERE id=$1 AND checkout_lease=$2 AND checkout_state IN ('creating','uncertain') RETURNING *`,
      [id, lease, preferenceId, checkoutUrl]);
      if (!order) throw new Error('CHECKOUT_LEASE_LOST');
      return order;
    },
    async uncertainCheckout(id, lease) {
      await pool.query(`UPDATE commerce_orders SET checkout_state='uncertain' WHERE id=$1 AND checkout_lease=$2 AND checkout_state='creating'`, [id, lease]);
    },
    async applyPayment(orderId, payment) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const order = (await client.query('SELECT * FROM commerce_orders WHERE id=$1 FOR UPDATE', [orderId])).rows[0];
        if (!order) throw new Error('ORDER_NOT_FOUND');
        const prior = (await client.query('SELECT order_id FROM commerce_payments WHERE id=$1', [payment.id])).rows[0];
        if (prior && prior.order_id !== orderId) throw new Error('PAYMENT_ORDER_CONFLICT');
        await client.query(`INSERT INTO commerce_payments (id, order_id, status, provider_updated_at) VALUES ($1,$2,$3,$4)
          ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,provider_updated_at=EXCLUDED.provider_updated_at,observed_at=now()
          WHERE commerce_payments.order_id=EXCLUDED.order_id AND (commerce_payments.provider_updated_at<EXCLUDED.provider_updated_at
            OR (commerce_payments.provider_updated_at=EXCLUDED.provider_updated_at AND EXCLUDED.status IN ('refunded','disputed')))`,
        [payment.id, orderId, payment.status, payment.updatedAt]);
        const owner = (await client.query('SELECT order_id FROM commerce_payments WHERE id=$1', [payment.id])).rows[0];
        if (owner?.order_id !== orderId) throw new Error('PAYMENT_ORDER_CONFLICT');
        const states = (await client.query('SELECT status FROM commerce_payments WHERE order_id=$1', [orderId])).rows.map(row => row.status);
        const status = states.includes('approved') ? 'approved' : states.includes('disputed') ? 'disputed' : states.includes('refunded') ? 'refunded' : states.includes('pending') ? 'pending' : 'failed';
        const result = (await client.query('UPDATE commerce_orders SET status=$2,reconciled_at=now() WHERE id=$1 RETURNING *', [orderId, status])).rows[0];
        await client.query('COMMIT');
        return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async enqueueEvent(id, paymentId) {
      await pool.query('INSERT INTO commerce_events(id,payment_id) VALUES($1,$2) ON CONFLICT(id) DO NOTHING', [id, paymentId]);
    },
    async claimEvents() {
      const claimId = randomUUID();
      return (await pool.query(`WITH pending AS (
        SELECT id FROM commerce_events WHERE completed_at IS NULL AND available_at<=now() AND (lease_until IS NULL OR lease_until<now())
        ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 3
      ) UPDATE commerce_events e SET claim_id=$1,lease_until=now()+interval '60 seconds',attempts=attempts+1
        FROM pending p WHERE e.id=p.id RETURNING e.*`, [claimId])).rows;
    },
    async completeEvent(id, claimId) {
      await pool.query('UPDATE commerce_events SET completed_at=now(),lease_until=NULL,last_error=NULL WHERE id=$1 AND claim_id=$2', [id, claimId]);
    },
    async retryEvent(id, claimId) {
      await pool.query(`UPDATE commerce_events SET lease_until=NULL,last_error='RECONCILIATION_FAILED',
        available_at=now()+(LEAST(3600,30*power(2,LEAST(attempts,7)))::text || ' seconds')::interval WHERE id=$1 AND claim_id=$2`, [id, claimId]);
    },
  };
}
let repositoryPromise;
function getOrderRepository(env = process.env) {
  if (!repositoryPromise) repositoryPromise = import('@netlify/database').then(({ getDatabase }) => {
    const db = getDatabase(env.NETLIFY_DB_URL ? { connectionString: env.NETLIFY_DB_URL } : undefined);
    return createOrderRepository(db.pool);
  }).catch(error => { repositoryPromise = null; throw error; });
  return repositoryPromise;
}
module.exports = { createOrderRepository, getOrderRepository };
