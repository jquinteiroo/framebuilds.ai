'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, randomUUID } = require('node:crypto');
const { createPayments } = require('../netlify/lib/payments.cjs');
const catalog = require('../packages.json');
const env = { URL: 'https://framebuildsai.netlify.app', MERCADOPAGO_TEST_ENABLED: 'true',
  MERCADOPAGO_TEST_ACCESS_TOKEN: 'fake-test-access-token-for-unit-tests',
  MERCADOPAGO_WEBHOOK_SECRET: 'fake-webhook-secret-for-unit-tests-only' };
const id = 'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const now = 1795630000000;
const post = body => ({ httpMethod: 'POST', headers: { origin: env.URL, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const parse = res => JSON.parse(res.body);
function fixture({ mutate = order => order, fail = false } = {}) {
  const calls = [];
  let stored;
  const app = createPayments({ env, now: () => now, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (fail) return new Response(JSON.stringify({ token: env.MERCADOPAGO_TEST_ACCESS_TOKEN }), { status: 401 });
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      stored = { ...body, id, currency: 'BRL', total_paid_amount: '0.00', status: 'created', status_detail: 'created',
        checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${id}` };
    }
    return Response.json(mutate(structuredClone(stored)));
  } });
  return { app, calls, get order() { return stored; } };
}
async function start(f, packageId = 'conteudo', attemptId = randomUUID()) {
  const result = await f.app.checkout(post({ packageId, attemptId }));
  assert.equal(result.statusCode, 200, result.body);
  return parse(result);
}

test('checkout is disabled without explicit test configuration and exposes no secret', async () => {
  const app = createPayments({ env: {} });
  const config = await app.config({ httpMethod: 'GET' });
  assert.deepEqual(parse(config), { enabled: false, mode: 'test', livePaymentsEnabled: false, deliveryEnabled: false });
  assert.equal((await app.checkout(post({ packageId: 'conteudo', attemptId: randomUUID() }))).statusCode, 503);
  const ready = await fixture().app.config({ httpMethod: 'GET' });
  assert.equal(parse(ready).enabled, true);
  assert.ok(!ready.body.includes(env.MERCADOPAGO_TEST_ACCESS_TOKEN));
  assert.ok(!ready.body.includes(env.MERCADOPAGO_WEBHOOK_SECRET));
});

for (const pack of catalog.packages) {
  test(`server sets the exact price, item and return URLs for ${pack.id}`, async () => {
    const f = fixture();
    const attempt = randomUUID();
    const result = await start(f, pack.id, attempt);
    const call = f.calls[0];
    const payload = JSON.parse(call.options.body);
    assert.equal(call.url, 'https://api.mercadopago.com/v1/orders');
    assert.equal(call.options.headers['X-Idempotency-Key'], attempt);
    assert.equal(payload.total_amount, (pack.priceCents / 100).toFixed(2));
    assert.deepEqual(payload.items, [{ title: pack.name, quantity: 1, unit_price: (pack.priceCents / 100).toFixed(2) }]);
    assert.equal(payload.processing_mode, 'manual');
    assert.equal(payload.config.online.success_url, `${env.URL}/pagamento.html`);
    assert.equal(payload.external_reference, `fb_${pack.id}_${attempt}`);
    assert.match(payload.external_reference, /^[A-Za-z0-9_-]{1,64}$/);
    assert.equal(result.mode, 'test');
    assert.ok(result.receipt);
    assert.ok(!JSON.stringify(result).includes(env.MERCADOPAGO_TEST_ACCESS_TOKEN));
  });
}

test('tampered prices, unknown packages, bad attempts, wrong origins and oversized bodies make no API call', async () => {
  const f = fixture();
  for (const input of [
    { packageId: 'completo', attemptId: randomUUID(), priceCents: 1 },
    { packageId: 'unknown', attemptId: randomUUID() },
    { packageId: 'conteudo', attemptId: 'not-a-uuid' },
  ]) assert.equal((await f.app.checkout(post(input))).statusCode, 400);
  const crossOrigin = post({ packageId: 'conteudo', attemptId: randomUUID() });
  crossOrigin.headers.origin = 'https://untrusted.example';
  assert.equal((await f.app.checkout(crossOrigin)).statusCode, 403);
  assert.equal((await f.app.checkout({ httpMethod: 'GET' })).statusCode, 405);
  assert.equal((await f.app.checkout({ ...post({}), body: 'invalid json' })).statusCode, 400);
  assert.equal((await f.app.checkout(post({ text: 'x'.repeat(10000) }))).statusCode, 413);
  assert.equal(f.calls.length, 0);
});

test('retries preserve the same provider idempotency key', async () => {
  const f = fixture(); const attempt = randomUUID();
  await start(f, 'completo', attempt); await start(f, 'completo', attempt);
  assert.deepEqual(f.calls.map(call => call.options.headers['X-Idempotency-Key']), [attempt, attempt]);
  assert.equal(f.calls[0].options.body, f.calls[1].options.body);
});

test('live orders, wrong amounts, wrong currency and foreign checkout URLs never reach the browser', async () => {
  for (const mutate of [
    order => ({ ...order, id: 'ORD01KS5AJ6HTK2HRQ3XJ3C2JCKP9' }),
    order => ({ ...order, total_amount: '0.01' }),
    order => ({ ...order, currency: 'ARS' }),
    order => ({ ...order, checkout_url: 'https://untrusted.example/checkout/' }),
    order => ({ ...order, checkout_url: `https://www.mercadopago.com.br:8443/checkout/?order_id=${id}` }),
    order => ({ ...order, checkout_url: `https://user:pass@www.mercadopago.com.br/checkout/?order_id=${id}` }),
  ]) {
    const result = await fixture({ mutate }).app.checkout(post({ packageId: 'conteudo', attemptId: randomUUID() }));
    assert.equal(result.statusCode, 502);
    assert.ok(!('checkoutUrl' in parse(result)));
  }
});

test('provider errors are sanitized and never expose credentials', async () => {
  const res = await fixture({ fail: true }).app.checkout(post({ packageId: 'conteudo', attemptId: randomUUID() }));
  assert.equal(res.statusCode, 502);
  assert.ok(!res.body.includes(env.MERCADOPAGO_TEST_ACCESS_TOKEN));
  assert.match(parse(res).error, /MP_HTTP_401/);
});

test('signed receipts reject tampering or expiry before querying any order', async () => {
  const f = fixture(); const { receipt } = await start(f);
  assert.equal((await f.app.status(post({ receipt: receipt.slice(0, -5) + '00000' }))).statusCode, 401);
  assert.equal((await f.app.status(post({ receipt, orderId: 'other' }))).statusCode, 400);
  const expired = createPayments({ env, now: () => now + 86400001, fetchImpl: () => { throw new Error('must not fetch'); } });
  assert.equal((await expired.status(post({ receipt }))).statusCode, 401);
  assert.equal(f.calls.length, 1);
});

test('only a re-read accredited and fully paid order is approved, with delivery always disabled', async () => {
  for (const [status, detail, paid, expected] of [
    ['created', 'created', '0.00', 'pending'],
    ['processed', 'accredited', '19.90', 'approved'],
    ['processed', 'accredited', '0.01', 'pending'],
    ['refunded', 'refunded', '19.90', 'failed'],
    ['failed', 'rejected', '0.00', 'failed'],
  ]) {
    let confirming = false;
    const f = fixture({ mutate: order => confirming ? ({ ...order, status, status_detail: detail, total_paid_amount: paid }) : order });
    const { receipt } = await start(f);
    confirming = true;
    const result = await f.app.status(post({ receipt }));
    assert.equal(result.statusCode, 200);
    assert.equal(parse(result).status, expected);
    assert.equal(parse(result).deliveryEnabled, false);
    assert.equal(f.calls[1].url, `https://api.mercadopago.com/v1/orders/${id}`);
  }
});

function notification(overrides = {}) {
  const requestId = randomUUID(); const ts = String(now);
  const signature = createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
  return { ...post({ type: 'order', live_mode: false, action: 'order.processed', data: { id } }),
    headers: { 'content-type': 'application/json', 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${signature}` },
    queryStringParameters: { type: 'order', 'data.id': id }, ...overrides };
}
test('webhooks require valid signatures and matching IDs before looking up the order', async () => {
  const f = fixture();
  const invalid = notification(); invalid.headers['x-signature'] += '00';
  assert.equal((await f.app.webhook(invalid)).statusCode, 401);
  const mismatch = notification(); mismatch.body = JSON.stringify({ type: 'order', live_mode: false, data: { id: 'other' } });
  assert.equal((await f.app.webhook(mismatch)).statusCode, 400);
  assert.equal(f.calls.length, 0);
});
test('valid duplicate notifications are safe, ignore production and never grant downloads', async () => {
  const f = fixture(); await start(f);
  const event = notification();
  for (let i = 0; i < 2; i++) {
    const result = await f.app.webhook(event);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(parse(result), { received: true, verified: true, mode: 'test', deliveryEnabled: false });
  }
  const live = notification(); live.body = JSON.stringify({ type: 'order', live_mode: true, data: { id } });
  assert.equal(parse(await f.app.webhook(live)).ignored, true);
  assert.equal(f.calls.length, 3);
});

test('the panel simulation for a Point order with a dummy ID never confirms a checkout', async () => {
  const f = fixture();
  const event = notification();
  const dummyId = '123456';
  const requestId = event.headers['x-request-id'];
  const signature = createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET).update(`id:${dummyId};request-id:${requestId};ts:${now};`).digest('hex');
  event.headers['x-signature'] = `ts=${now},v1=${signature}`;
  event.queryStringParameters['data.id'] = dummyId;
  event.body = JSON.stringify({ type: 'order', live_mode: false, action: 'order.processed', data: { id: dummyId, type: 'point', status: 'processed', status_detail: 'accredited', total_paid_amount: 100000 } });
  const result = await f.app.webhook(event);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(parse(result), { received: true, ignored: true });
  assert.equal(f.calls.length, 0);
});
