'use strict';
const { createHash, createHmac } = require('node:crypto');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const catalog = require('../../packages.json');
const manifest = require('../../product-manifest.json');
const { getOrderRepository } = require('./order-repository.cjs');
const { getProductAssets, validAsset } = require('./product-assets.cjs');
const { cents, PaymentError, response, header, bodyOf, equalHex } = require('./payments.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_ID = /^\d{1,20}$/;
const packMap = new Map(catalog.packages.map(pack => [pack.id, pack]));
function createCommerce({ env = process.env, repository, assets, provider, fetchImpl = globalThis.fetch, now = Date.now, salesOpen = catalog.salesOpen === true } = {}) {
  const site = new URL(env.APP_URL || env.URL || 'http://localhost:3000');
  const publicAppUrl = /^https:\/\//i.test(site.origin) && !/^https:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(site.origin);
  const token = env.MERCADOPAGO_ACCESS_TOKEN || '';
  const secret = env.MERCADOPAGO_ORDER_SECRET || '';
  const webhookSecret = env.MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET || '';
  const sellerId = env.MERCADOPAGO_SELLER_ID || '';
  const configured = env.MERCADOPAGO_MODE === 'production' && publicAppUrl && token.length > 10 && secret.length >= 64 && webhookSecret.length >= 32 && PAYMENT_ID.test(sellerId);
  const client = new MercadoPagoConfig({ accessToken: token, options: { timeout: 5000, maxRetries: 0 } });
  const preferenceClient = new Preference(client);
  const paymentClient = new Payment(client);
  const gateway = provider || {
    createPreference: (body, idempotencyKey) => preferenceClient.create({ body, requestOptions: { idempotencyKey } }),
    findPreferences: reference => preferenceClient.search({ options: { external_reference: reference } }),
    findPayments: reference => paymentClient.search({ options: { external_reference: reference, limit: 100 } }),
    getPayment: id => paymentClient.get({ id }),
  };
  const repo = () => repository ? Promise.resolve(repository) : getOrderRepository(env);
  const products = event => assets ? Promise.resolve(assets) : getProductAssets(event);
  const requireConfigured = () => { if (!configured) throw new PaymentError(503, 'O pagamento ainda está em preparação. Tente novamente mais tarde.'); };
  const requirePost = event => { if (event.httpMethod !== 'POST') throw new PaymentError(405, 'Método não permitido.'); };
  const requireOrigin = event => { if (header(event, 'origin') !== site.origin) throw new PaymentError(403, 'Origem não permitida.'); };
  const sign = value => createHmac('sha256', secret).update('framebuilds-live-v1:' + value).digest('hex');
  function makeReceipt(order) {
    const value = Buffer.from(JSON.stringify({ v: 1, mode: 'production', orderId: order.id, expires: new Date(order.created_at).getTime() + 30 * 86400000 })).toString('base64url');
    return value + '.' + sign(value);
  }
  function readReceipt(receipt) {
    if (typeof receipt !== 'string' || receipt.length > 2048) throw new PaymentError(401, 'Seu link de acesso é inválido.');
    const [value, signature, extra] = receipt.split('.');
    if (!value || extra || !equalHex(signature, sign(value))) throw new PaymentError(401, 'Seu link de acesso é inválido.');
    let claims;
    try { claims = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch { throw new PaymentError(401, 'Seu link de acesso é inválido.'); }
    if (claims.v !== 1 || claims.mode !== 'production' || !UUID.test(claims.orderId) || !Number.isFinite(claims.expires) || claims.expires < now()) throw new PaymentError(401, 'Seu link de acesso expirou ou é inválido.');
    return claims;
  }
  async function ownedOrder(receipt) {
    const claims = readReceipt(receipt);
    const order = await (await repo()).getOrder(claims.orderId);
    if (!order || order.mode !== 'production' || order.seller_id !== sellerId || !packMap.has(order.package_id)) throw new PaymentError(404, 'Não encontramos este pedido.');
    return order;
  }
  async function verifySeller() {
    const res = await fetchImpl('https://api.mercadopago.com/users/me', { headers: { Authorization: 'Bearer ' + token }, redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('SELLER_LOOKUP_FAILED');
    const seller = await res.json();
    if (String(seller.id) !== sellerId || seller.site_id !== 'MLB' || !Array.isArray(seller.tags) || seller.tags.includes('test_user')) throw new PaymentError(503, 'A conta de recebimento ainda precisa ser configurada.');
  }
  function inspectPreference(preference, order) {
    const item = preference.items?.[0];
    let url;
    try { url = new URL(preference.init_point); } catch { throw new Error('INVALID_CHECKOUT'); }
    if (!/^[a-z0-9_-]{8,150}$/i.test(preference.id || '') || String(preference.collector_id) !== sellerId || preference.external_reference !== order.reference || preference.items?.length !== 1 || item.currency_id !== 'BRL' || item.quantity !== 1 || cents(item.unit_price) !== order.amount_cents || url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.br' || url.port || url.username || url.password || !url.pathname.startsWith('/checkout/') || url.searchParams.get('pref_id') !== preference.id) throw new Error('INVALID_CHECKOUT');
    return url.href;
  }
  function inspectPayment(payment, order) {
    const updated = Date.parse(payment.date_last_updated);
    const refunded = cents(payment.transaction_amount_refunded ?? 0);
    if (!PAYMENT_ID.test(String(payment.id)) || payment.live_mode !== true || String(payment.collector_id) !== sellerId || payment.currency_id !== order.currency || payment.external_reference !== order.reference || cents(payment.transaction_amount) !== order.amount_cents || !Number.isFinite(updated) || !Number.isSafeInteger(refunded) || refunded < 0 || refunded > order.amount_cents) throw new Error('PAYMENT_MISMATCH');
    const status = payment.status === 'charged_back' ? 'disputed' : refunded > 0 || payment.status === 'refunded' ? 'refunded' : payment.status === 'approved' && payment.status_detail === 'accredited' ? 'approved' : ['rejected', 'cancelled'].includes(payment.status) ? 'failed' : 'pending';
    return { id: String(payment.id), status, updatedAt: new Date(updated).toISOString() };
  }
  async function synchronize(order) {
    const result = await gateway.findPayments(order.reference);
    if (!Array.isArray(result.results) || result.results.length > 100) throw new Error('INVALID_PAYMENT_SEARCH');
    const db = await repo();
    for (const payment of result.results) await db.applyPayment(order.id, inspectPayment(payment, order));
    return db.getOrder(order.id);
  }
  const guarded = action => async event => {
    try { return await action(event); }
    catch (error) {
      return response(error instanceof PaymentError ? error.status : 503, { error: error instanceof PaymentError ? error.message : 'Não foi possível concluir esta etapa. Aguarde alguns instantes e tente novamente.' });
    }
  };
  const allAssetsConfigured = () => [...packMap.keys()].every(id => assets ? assets.configured(id) : validAsset(manifest[id]));
  return {
    config: guarded(async event => {
      if (event.httpMethod !== 'GET') throw new PaymentError(405, 'Método não permitido.');
      let enabled = configured && salesOpen && env.MERCADOPAGO_LIVE_ENABLED === 'true' && allAssetsConfigured();
      if (enabled) {
        try {
          await (await repo()).ready();
          const store = await products(event);
          for (const id of packMap.keys()) if (!await store.getAsset(id)) enabled = false;
        } catch { enabled = false; }
      }
      return response(200, { enabled, mode: 'production', livePaymentsEnabled: enabled, deliveryEnabled: enabled });
    }),
    checkout: guarded(async event => {
      requirePost(event); requireConfigured(); requireOrigin(event);
      if (!salesOpen || env.MERCADOPAGO_LIVE_ENABLED !== 'true' || !allAssetsConfigured()) throw new PaymentError(503, 'As vendas ainda não estão abertas.');
      const input = bodyOf(event, ['packageId', 'attemptId']);
      const pack = packMap.get(input.packageId);
      if (!pack || !UUID.test(input.attemptId)) throw new PaymentError(400, 'Pacote ou tentativa inválida.');
      await verifySeller();
      const store = await products(event);
      const asset = await store.getAsset(pack.id);
      if (!asset) throw new PaymentError(503, 'Este pacote ainda não está disponível para entrega.');
      const db = await repo();
      let order = await db.ensureOrder({ mode: 'production', attemptId: input.attemptId, packageId: pack.id, priceCents: pack.priceCents, sellerId, asset });
      if (order.amount_cents !== pack.priceCents) throw new PaymentError(409, 'O preço foi atualizado. Feche esta janela e inicie uma nova compra.');
      const expiresAt = new Date(order.created_at).getTime() + 86400000;
      if (expiresAt <= now()) throw new PaymentError(409, 'Esta tentativa expirou. Feche esta janela e inicie uma nova compra.');
      if (order.checkout_state !== 'ready') {
        const claimed = await db.claimCheckout(order.id);
        if (claimed) {
          const publicAppUrl = /^https:\/\//i.test(site.origin) && !/^https:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(site.origin);
          try {
            const preference = await gateway.createPreference({
              items: [{ id: pack.id, title: pack.name, description: 'Pacote digital framebuilds.ai — ' + pack.name, quantity: 1, unit_price: order.amount_cents / 100, currency_id: 'BRL' }],
              back_urls: { success: site.origin + '/pagamento.html', failure: site.origin + '/pagamento.html', pending: site.origin + '/pagamento.html' },
              ...(publicAppUrl ? { auto_return: 'approved' } : {}),
              notification_url: site.origin + '/.netlify/functions/mercadopago-webhook',
              external_reference: order.reference, statement_descriptor: 'FRAMEBUILDS',
              expires: true, expiration_date_from: new Date(order.created_at).toISOString(), expiration_date_to: new Date(expiresAt).toISOString(),
            }, order.id);
            order = await db.savePreference(order.id, claimed.checkout_lease, preference.id, inspectPreference(preference, order));
          } catch {
            await db.uncertainCheckout(order.id, claimed.checkout_lease);
            throw new PaymentError(503, 'Estamos conferindo esta tentativa. Aguarde alguns instantes e tente novamente.');
          }
        } else {
          order = await db.getOrder(order.id);
          if (order.checkout_state === 'ready') { /* another request finished */ }
          else if (order.checkout_state === 'uncertain' || Date.parse(order.checkout_lease_until) < now()) {
            const found = await gateway.findPreferences(order.reference);
            const matching = (found.elements || found.results || []).filter(p => p.external_reference === order.reference);
            if (matching.length !== 1) throw new PaymentError(409, 'Estamos conferindo esta tentativa. Aguarde antes de tentar novamente.');
            order = await db.savePreference(order.id, order.checkout_lease, matching[0].id, inspectPreference(matching[0], order));
          } else throw new PaymentError(409, 'O checkout está sendo preparado. Aguarde alguns instantes.');
        }
      }
      return response(200, { mode: 'production', checkoutUrl: order.checkout_url, receipt: makeReceipt(order) });
    }),
    status: guarded(async event => {
      requirePost(event); requireConfigured(); requireOrigin(event);
      const order = await synchronize(await ownedOrder(bodyOf(event, ['receipt']).receipt));
      return response(200, { mode: 'production', packageName: packMap.get(order.package_id).name, priceCents: order.amount_cents, orderId: order.id, status: order.status, deliveryEnabled: order.status === 'approved', paymentId: (await (await repo()).approvedPayments(order.id))[0]?.id || null });
    }),
    webhook: guarded(async event => {
      if (event.httpMethod === 'GET') return response(200, { mode: 'production', configured });
      requirePost(event); requireConfigured();
      const id = event.queryStringParameters?.['data.id'];
      const requestId = header(event, 'x-request-id');
      const parts = header(event, 'x-signature').split(',').map(p => p.trim().split('=').map(v => v.trim()));
      const ts = parts.find(([key]) => key === 'ts')?.[1];
      const hashes = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
      if (!PAYMENT_ID.test(id || '') || !/^[a-z0-9-]{1,100}$/i.test(requestId) || !/^\d{10,13}$/.test(ts || '')) throw new PaymentError(401, 'Notificação não autenticada.');
      const expected = createHmac('sha256', webhookSecret).update('id:' + id + ';request-id:' + requestId + ';ts:' + ts + ';').digest('hex');
      if (!hashes.some(hash => equalHex(hash, expected))) throw new PaymentError(401, 'Notificação não autenticada.');
      const input = bodyOf(event);
      if (String(input.data?.id) !== id) throw new PaymentError(400, 'Notificação inválida.');
      if (input.type !== 'payment' || input.live_mode !== true || (input.user_id != null && String(input.user_id) !== sellerId) || (event.queryStringParameters.type && event.queryStringParameters.type !== 'payment')) return response(200, { received: true, ignored: true });
      // Commit the event to the durable inbox before acknowledging. No Mercado
      // Pago lookup or post-response work happens in this request.
      const key = createHash('sha256').update(id + ':' + requestId + ':' + ts).digest('hex');
      await (await repo()).enqueueEvent(key, id);
      return response(200, { received: true });
    }),
    async authorizeDownload(receipt, event) {
      requireConfigured();
      let order = await ownedOrder(receipt);
      const db = await repo();
      // Re-read approved payment IDs from the provider before every download,
      // so refunds/chargebacks revoke access even if a webhook is delayed.
      const approved = await db.approvedPayments(order.id);
      let currentApproval = false;
      for (const row of approved) {
        const payment = inspectPayment(await gateway.getPayment(row.id), order);
        order = await db.applyPayment(order.id, payment);
        if (payment.status === 'approved' && order.status === 'approved') { currentApproval = true; break; }
      }
      if (!currentApproval) throw new PaymentError(403, 'O download estará disponível após a confirmação do pagamento.');
      const store = await products(event);
      return { stream: await store.stream(order.asset), fileName: order.asset.fileName, size: order.asset.size };
    },
    async reconcileEvents() {
      if (!configured) return { attempted: 0, completed: 0, disabled: true };
      const db = await repo();
      const events = await db.claimEvents();
      let completed = 0;
      for (const event of events) {
        try {
          const payment = await gateway.getPayment(event.payment_id);
          const order = await db.findOrder(payment.external_reference);
          if (order && order.mode === 'production' && order.seller_id === sellerId) await db.applyPayment(order.id, inspectPayment(payment, order));
          await db.completeEvent(event.id, event.claim_id); completed++;
        } catch { await db.retryEvent(event.id, event.claim_id); }
      }
      return { attempted: events.length, completed };
    },
  };
}
module.exports = { createCommerce };
