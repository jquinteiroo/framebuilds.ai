'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomUUID, createHmac } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { createOrderRepository } = require('../netlify/lib/order-repository.cjs');
const { createCommerce } = require('../netlify/lib/commerce.cjs');
const { createProductAssets } = require('../netlify/lib/product-assets.cjs');
const env = { URL: 'https://framebuildsai.netlify.app', MERCADOPAGO_MODE: 'production', MERCADOPAGO_LIVE_ENABLED: 'true',
  MERCADOPAGO_ACCESS_TOKEN: 'fake-production-access-token-for-unit-tests',
  MERCADOPAGO_SELLER_ID: '326355222',
  MERCADOPAGO_ORDER_SECRET: 'fake-order-signing-secret-for-tests-only-'.repeat(2),
  MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET: 'fake-production-webhook-secret-for-tests-only' };
const bytes = new Uint8Array([80, 75, 3, 4, 1, 2, 3, 4]);
const asset = { key: 'packages/' + 'a'.repeat(64) + '.zip', sha256: 'a'.repeat(64), fileName: 'conteudo.zip', size: bytes.length };
const post = body => ({ httpMethod: 'POST', headers: { origin: env.URL, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const parse = result => JSON.parse(result.body);
async function fixture(t, options = {}) {
  const db = new PGlite();
  await db.exec(readFileSync(require.resolve('../netlify/database/migrations/202611260001_commerce.sql'), 'utf8'));
  t.after(() => db.close());
  let lock = Promise.resolve();
  const pool = {
    query: (sql, args) => db.query(sql, args),
    async connect() {
      let release; const previous = lock; lock = new Promise(resolve => { release = resolve; }); await previous;
      return { query: (sql, args) => db.query(sql, args), release };
    },
  };
  const repository = createOrderRepository(pool);
  const preferences = new Map(), payments = new Map();
  let creates = 0, reads = 0, failGet = false, ambiguous = options.ambiguous || false, clock = Date.now();
  const entries = Object.fromEntries(['conteudo', 'estrategia', 'sites', 'video', 'completo'].map(id => [id, { ...asset, fileName: id + '.zip' }]));
  const assets = createProductAssets({ entries: options.noAssets ? {} : entries, store: {
    getMetadata: async () => options.missingFile ? null : { metadata: { sha256: asset.sha256, size: bytes.length } },
    get: async () => new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }),
  } });
  const provider = {
    async createPreference(body, key) {
      creates++;
      const id = env.MERCADOPAGO_SELLER_ID + '-' + randomUUID();
      const result = { ...body, id, collector_id: Number(env.MERCADOPAGO_SELLER_ID), init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=' + id, key };
      preferences.set(id, result);
      if (ambiguous) { ambiguous = false; throw new Error('private-provider-response'); }
      return result;
    },
    findPreferences: async reference => ({ elements: [...preferences.values()].filter(p => p.external_reference === reference) }),
    findPayments: async reference => ({ results: [...payments.values()].filter(p => p.external_reference === reference) }),
    async getPayment(id) { reads++; if (failGet) throw new Error('private-failure'); return payments.get(id); },
  };
  const app = createCommerce({ env: { ...env, ...options.env }, repository: options.repository || repository, assets, provider,
    salesOpen: options.salesOpen !== false, now: () => clock,
    fetchImpl: async () => Response.json(options.seller || { id: Number(env.MERCADOPAGO_SELLER_ID), site_id: 'MLB', tags: ['user'] }) });
  async function start(packageId = 'conteudo', attemptId = randomUUID()) {
    const result = await app.checkout(post({ packageId, attemptId }));
    assert.equal(result.statusCode, 200, result.body);
    const data = parse(result);
    const claims = JSON.parse(Buffer.from(data.receipt.split('.')[0], 'base64url').toString());
    return { ...data, order: await repository.getOrder(claims.orderId), attemptId };
  }
  function payment(order, overrides = {}) {
    const p = { id: '1234567890', collector_id: Number(env.MERCADOPAGO_SELLER_ID), live_mode: true, currency_id: 'BRL',
      external_reference: order.reference, transaction_amount: order.amount_cents / 100, transaction_amount_refunded: 0,
      status: 'approved', status_detail: 'accredited', date_last_updated: '2026-11-26T12:00:00.000Z', ...overrides };
    payments.set(String(p.id), p); return p;
  }
  return { db, repository, app, start, payment, provider, get creates() { return creates; }, get reads() { return reads; },
    failGet(value) { failGet = value; }, advance(ms) { clock += ms; } };
}
function notification(id = '1234567890', overrides = {}) {
  const requestId = randomUUID(), ts = String(Date.now());
  const signature = createHmac('sha256', env.MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET).update('id:' + id + ';request-id:' + requestId + ';ts:' + ts + ';').digest('hex');
  return { ...post({ type: 'payment', live_mode: true, data: { id }, ...overrides }),
    headers: { 'content-type': 'application/json', 'x-request-id': requestId, 'x-signature': 'ts=' + ts + ',v1=' + signature },
    queryStringParameters: { 'data.id': id, type: 'payment' } };
}
test('production is disabled without complete configuration and exposes no secrets', async () => {
  const app = createCommerce({ env: {} });
  assert.deepEqual(parse(await app.config({ httpMethod: 'GET' })), { enabled: false, mode: 'production', livePaymentsEnabled: false, deliveryEnabled: false });
  assert.equal((await app.checkout(post({}))).statusCode, 503);
});
test('missing product files, missing blobs and closed sales prevent preference creation', async t => {
  for (const options of [{ noAssets: true }, { missingFile: true }, { salesOpen: false }]) {
    const f = await fixture(t, options);
    assert.equal(parse(await f.app.config({ httpMethod: 'GET' })).enabled, false);
    const r = await f.app.checkout(post({ packageId: 'conteudo', attemptId: randomUUID() }));
    assert.equal(r.statusCode, 503); assert.equal(f.creates, 0);
  }
});
test('production rejects test sellers and a seller other than the configured receiver', async t => {
  for (const seller of [{ id: 326355222, site_id: 'MLB', tags: ['test_user'] }, { id: 123, site_id: 'MLB', tags: ['user'] }]) {
    const f = await fixture(t, { seller });
    assert.equal((await f.app.checkout(post({ packageId: 'conteudo', attemptId: randomUUID() }))).statusCode, 503);
    assert.equal(f.creates, 0);
  }
});
test('prices and payment IDs supplied by the browser are rejected', async t => {
  const f = await fixture(t);
  for (const extra of [{ priceCents: 1 }, { paymentId: 'other' }]) assert.equal((await f.app.checkout(post({ packageId: 'conteudo', attemptId: randomUUID(), ...extra }))).statusCode, 400);
  assert.equal(f.creates, 0);
});
test('a durable order and stable provider key are reused for a repeated attempt', async t => {
  const f = await fixture(t); const first = await f.start(); const again = await f.start('conteudo', first.attemptId);
  assert.equal(f.creates, 1); assert.equal(first.order.id, again.order.id); assert.equal(first.checkoutUrl, again.checkoutUrl);
  const pref = await f.provider.findPreferences(first.order.reference);
  assert.equal(pref.elements[0].key, first.order.id);
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM commerce_orders')).rows[0].n, 1);
});
test('concurrent submits claim a preference only once in PostgreSQL', async t => {
  const f = await fixture(t); const attemptId = randomUUID();
  const results = await Promise.all([f.app.checkout(post({ packageId: 'conteudo', attemptId })), f.app.checkout(post({ packageId: 'conteudo', attemptId }))]);
  assert.ok(results.some(r => r.statusCode === 200));
  assert.ok(results.every(r => [200, 409].includes(r.statusCode)));
  assert.equal(f.creates, 1);
});

test('checkout expiry is tied to the durable order and prevents paying an old attempt', async t => {
  const f = await fixture(t); const started = await f.start();
  const pref = (await f.provider.findPreferences(started.order.reference)).elements[0];
  assert.equal(pref.expires, true);
  assert.equal(Date.parse(pref.expiration_date_to) - Date.parse(pref.expiration_date_from), 86400000);
  f.advance(2 * 86400000);
  const retry = await f.app.checkout(post({ packageId: 'conteudo', attemptId: started.attemptId }));
  assert.equal(retry.statusCode, 409); assert.equal(f.creates, 1);
});
test('a provider timeout is reconciled by reference instead of creating another preference', async t => {
  const f = await fixture(t, { ambiguous: true }); const attemptId = randomUUID();
  const first = await f.app.checkout(post({ packageId: 'conteudo', attemptId }));
  assert.equal(first.statusCode, 503); assert.ok(!first.body.includes('private-provider'));
  const recovered = await f.start('conteudo', attemptId);
  assert.equal(f.creates, 1); assert.equal(recovered.order.checkout_state, 'ready');
});
test('failure to persist an order stops before calling preference creation', async t => {
  const f = await fixture(t, { repository: { ensureOrder: async () => { throw new Error('db-down'); } } });
  assert.equal((await f.app.checkout(post({ packageId: 'conteudo', attemptId: randomUUID() }))).statusCode, 503);
  assert.equal(f.creates, 0);
});
test('a valid approval is persisted and authorizes only the purchased private asset', async t => {
  const f = await fixture(t); const { order, receipt } = await f.start(); f.payment(order);
  const status = await f.app.status(post({ receipt }));
  assert.equal(parse(status).status, 'approved'); assert.equal(parse(status).deliveryEnabled, true);
  const file = await f.app.authorizeDownload(receipt);
  assert.equal(file.fileName, 'conteudo.zip'); assert.deepEqual(new Uint8Array(await new Response(file.stream).arrayBuffer()), bytes);
  assert.equal(f.reads, 1);
});
test('an unpaid order, a forged receipt and an expired receipt cannot download', async t => {
  const f = await fixture(t); const { receipt } = await f.start();
  await assert.rejects(f.app.authorizeDownload(receipt), error => error.status === 403);
  await assert.rejects(f.app.authorizeDownload(receipt.slice(0, -5) + 'xxxxx'), error => error.status === 401);
  f.advance(31 * 86400000);
  await assert.rejects(f.app.authorizeDownload(receipt), error => error.status === 401);
});
test('mismatched payment amount, seller, currency and test mode never grant access', async t => {
  for (const override of [{ transaction_amount: 0.01 }, { collector_id: 999 }, { currency_id: 'ARS' }, { live_mode: false }]) {
    const f = await fixture(t); const { order, receipt } = await f.start(); f.payment(order, override);
    const result = await f.app.status(post({ receipt }));
    assert.equal(result.statusCode, 503);
    assert.equal((await f.repository.getOrder(order.id)).status, 'pending');
    await assert.rejects(f.app.authorizeDownload(receipt), error => error.status === 403);
  }
});
test('refunds and chargebacks revoke access on download without depending on webhook arrival', async t => {
  for (const override of [{ status: 'refunded', transaction_amount_refunded: 19.90 }, { status: 'charged_back' }]) {
    const f = await fixture(t); const { order, receipt } = await f.start(); f.payment(order);
    assert.equal((await f.app.status(post({ receipt }))).statusCode, 200);
    f.payment(order, { ...override, date_last_updated: '2026-11-26T13:00:00Z' });
    await assert.rejects(f.app.authorizeDownload(receipt), error => error.status === 403);
    assert.notEqual((await f.repository.getOrder(order.id)).status, 'approved');
  }
});
test('an out-of-order approval cannot overwrite a newer refund, including equal timestamps', async t => {
  const f = await fixture(t); const { order } = await f.start();
  await f.repository.applyPayment(order.id, { id: '123', status: 'approved', updatedAt: '2026-11-26T12:00:00Z' });
  await f.repository.applyPayment(order.id, { id: '123', status: 'refunded', updatedAt: '2026-11-26T13:00:00Z' });
  for (const date of ['2026-11-26T12:00:00Z', '2026-11-26T13:00:00Z']) {
    assert.equal((await f.repository.applyPayment(order.id, { id: '123', status: 'approved', updatedAt: date })).status, 'refunded');
  }
});
test('the same payment ID cannot be attached to a different durable order', async t => {
  const f = await fixture(t); const a = await f.start(); const b = await f.start('video');
  const p = { id: '123', status: 'approved', updatedAt: '2026-11-26T12:00:00Z' };
  await f.repository.applyPayment(a.order.id, p);
  await assert.rejects(f.repository.applyPayment(b.order.id, p), /PAYMENT_ORDER_CONFLICT/);
  assert.equal((await f.repository.getOrder(b.order.id)).status, 'pending');
});
test('webhooks validate signatures, ignore test events and durably deduplicate retries', async t => {
  const f = await fixture(t); const valid = notification();
  const invalid = notification(); invalid.headers['x-signature'] += '00';
  assert.equal((await f.app.webhook(invalid)).statusCode, 401);
  assert.equal(parse(await f.app.webhook(notification('123', { live_mode: false }))).ignored, true);
  for (let i = 0; i < 2; i++) assert.equal((await f.app.webhook(valid)).statusCode, 200);
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM commerce_events')).rows[0].n, 1);
  assert.equal(f.reads, 0);
});
test('the durable worker confirms payment without a browser return and is idempotent', async t => {
  const f = await fixture(t); const { order } = await f.start(); f.payment(order);
  await f.app.webhook(notification());
  assert.deepEqual(await f.app.reconcileEvents(), { attempted: 1, completed: 1 });
  assert.equal((await f.repository.getOrder(order.id)).status, 'approved');
  assert.deepEqual(await f.app.reconcileEvents(), { attempted: 0, completed: 0 });
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM commerce_payments')).rows[0].n, 1);
});
test('worker failures retain events for retry without persisting private provider errors', async t => {
  const f = await fixture(t); const { order } = await f.start(); f.payment(order); f.failGet(true);
  await f.app.webhook(notification());
  assert.deepEqual(await f.app.reconcileEvents(), { attempted: 1, completed: 0 });
  const row = (await f.db.query('SELECT * FROM commerce_events')).rows[0];
  assert.equal(row.completed_at, null); assert.equal(row.last_error, 'RECONCILIATION_FAILED');
  assert.equal(row.attempts, 1);
  f.failGet(false);
  await f.db.query('UPDATE commerce_events SET available_at=now()');
  assert.deepEqual(await f.app.reconcileEvents(), { attempted: 1, completed: 1 });
});
test('previously paid orders remain usable when new sales are disabled', async t => {
  const f = await fixture(t); const { order, receipt } = await f.start(); f.payment(order);
  await f.app.status(post({ receipt }));
  const app = createCommerce({ env: { ...env, MERCADOPAGO_LIVE_ENABLED: 'false' }, repository: f.repository,
    salesOpen: false, provider: f.provider, assets: createProductAssets({ entries: {}, store: {
      getMetadata: async () => ({ metadata: { sha256: asset.sha256, size: bytes.length } }),
      get: async () => new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } }),
    } }) });
  assert.equal(parse(await app.config({ httpMethod: 'GET' })).enabled, false);
  const result = await app.authorizeDownload(receipt);
  assert.equal(result.fileName, 'conteudo.zip');
});
