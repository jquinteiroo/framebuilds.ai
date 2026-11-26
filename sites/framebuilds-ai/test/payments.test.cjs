'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, randomUUID } = require('node:crypto');
const { createPayments } = require('../netlify/lib/payments.cjs');
const catalog = require('../packages.json');
const env = { URL: 'https://framebuildsai.netlify.app', MERCADOPAGO_TEST_ENABLED: 'true',
  MERCADOPAGO_TEST_ACCESS_TOKEN: 'fake-test-access-token',
  MERCADOPAGO_TEST_SELLER_ID: '3877354270',
  MERCADOPAGO_RECEIPT_SECRET: 'fake-receipt-secret-for-unit-tests-only',
  MERCADOPAGO_WEBHOOK_SECRET: 'fake-webhook-secret-for-unit-tests-only' };
const id = '3877354270-12345678-1234-4234-8234-123456789abc';
const now = 1795630000000;
const post = body => ({ httpMethod: 'POST', headers: { origin: env.URL, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const parse = res => JSON.parse(res.body);
function fixture({ mutate = value => value, paymentMutate = value => value, seller = { id: 3877354270, site_id: 'MLB', tags: ['test_user'] }, fail = false, customEnv = env } = {}) {
  const calls = []; let stored; let paymentResults = [];
  const app = createPayments({ env: customEnv, now: () => now,
    fetchImpl: async (url, options) => {
      calls.push({ operation: 'seller', url, options });
      if (fail) return new Response('private provider details', { status: 401 });
      return Response.json(seller);
    },
    provider: {
      createPreference: async (body, key) => {
        calls.push({ operation: 'create', body, key });
        stored = { ...body, id, collector_id: 3877354270, init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=' + id };
        return mutate(structuredClone(stored));
      },
      getPreference: async preferenceId => { calls.push({ operation: 'get', preferenceId }); return mutate(structuredClone(stored)); },
      findPayments: async reference => { calls.push({ operation: 'search', reference }); return { results: paymentResults.map(paymentMutate) }; },
    },
  });
  return { app, calls, get preference() { return stored; }, setPayments(values) { paymentResults = values.map(value => ({ id: 1234567890, collector_id: 3877354270, live_mode: false, external_reference: stored.external_reference, currency_id: 'BRL', transaction_amount: stored.items[0].unit_price, transaction_amount_refunded: 0, status: 'pending', status_detail: 'pending_waiting_payment', ...value })); } };
}
async function start(f, packageId = 'conteudo', attemptId = randomUUID(), origin = env.URL) {
  const result = await f.app.checkout({ ...post({ packageId, attemptId }), headers: { origin, 'content-type': 'application/json' } });
  assert.equal(result.statusCode, 200, result.body);
  return parse(result);
}
test('missing test configuration disables checkout and public config exposes no secrets', async () => {
  const app = createPayments({ env: {} });
  assert.deepEqual(parse(await app.config({ httpMethod: 'GET' })), { enabled: false, mode: 'test', livePaymentsEnabled: false, deliveryEnabled: false, webhookConfigured: false });
  assert.equal((await app.checkout(post({}))).statusCode, 503);
  const configured = await fixture().app.config({ httpMethod: 'GET' });
  assert.equal(parse(configured).enabled, true);
  assert.ok(!configured.body.includes(env.MERCADOPAGO_TEST_ACCESS_TOKEN));
  assert.ok(!configured.body.includes(env.MERCADOPAGO_RECEIPT_SECRET));
});
for (const pack of catalog.packages) test('server controls preference price and return URLs for ' + pack.id, async () => {
  const f = fixture(); const attempt = randomUUID(); const result = await start(f, pack.id, attempt);
  const call = f.calls.find(c => c.operation === 'create');
  assert.equal(f.calls[0].operation, 'seller');
  assert.equal(call.key, attempt);
  assert.equal(call.body.items[0].unit_price, pack.priceCents / 100);
  assert.equal(call.body.items[0].quantity, 1);
  assert.equal(call.body.items[0].currency_id, 'BRL');
  assert.deepEqual(call.body.back_urls, Object.fromEntries(['success', 'failure', 'pending'].map(k => [k, env.URL + '/pagamento.html'])));
  assert.equal(call.body.auto_return, 'approved');
  assert.equal(call.body.notification_url, env.URL + '/.netlify/functions/mercadopago-webhook');
  assert.equal(call.body.external_reference, 'fb_' + pack.id + '_' + attempt);
  assert.equal(result.mode, 'test');
  assert.equal(new URL(result.checkoutUrl).searchParams.get('pref_id'), id);
  assert.ok(result.receipt);
});
test('raw client prices, unknown packages, bad attempts, foreign origins and oversized requests are rejected without provider calls', async () => {
  const f = fixture();
  for (const input of [{ packageId: 'completo', attemptId: randomUUID(), priceCents: 1 }, { packageId: 'unknown', attemptId: randomUUID() }, { packageId: 'conteudo', attemptId: 'invalid' }]) assert.equal((await f.app.checkout(post(input))).statusCode, 400);
  const cross = post({ packageId: 'conteudo', attemptId: randomUUID() }); cross.headers.origin = 'https://untrusted.example';
  assert.equal((await f.app.checkout(cross)).statusCode, 403);
  assert.equal((await f.app.checkout({ httpMethod: 'GET' })).statusCode, 405);
  assert.equal((await f.app.checkout({ ...post({}), body: 'invalid json' })).statusCode, 400);
  assert.equal((await f.app.checkout(post({ text: 'x'.repeat(9000) }))).statusCode, 413);
  assert.equal(f.calls.length, 0);
});
test('a real seller, a different test seller or a different country cannot create a preference', async () => {
  for (const seller of [{ id: 3877354270, site_id: 'MLB', tags: [] }, { id: 326355222, site_id: 'MLB', tags: ['test_user'] }, { id: 3877354270, site_id: 'MLA', tags: ['test_user'] }]) {
    const f = fixture({ seller });
    const r = await f.app.checkout(post({ packageId: 'conteudo', attemptId: randomUUID() }));
    assert.equal(r.statusCode, 503);
    assert.equal(f.calls.length, 1);
  }
});
test('retries preserve their provider idempotency key and server-controlled payload', async () => {
  const f = fixture(); const attempt = randomUUID();
  await start(f, 'completo', attempt); await start(f, 'completo', attempt);
  const calls = f.calls.filter(c => c.operation === 'create');
  assert.deepEqual(calls.map(c => c.key), [attempt, attempt]); assert.deepEqual(calls[0].body, calls[1].body);
});
test('localhost back URLs omit auto_return and notification_url', async () => {
  const f = fixture({ customEnv: { ...env, APP_URL: 'http://localhost:3000' } });
  await start(f, 'conteudo', randomUUID(), 'http://localhost:3000');
  const body = f.calls.find(c => c.operation === 'create').body;
  assert.equal(body.back_urls.success, 'http://localhost:3000/pagamento.html');
  assert.ok(!('auto_return' in body)); assert.ok(!('notification_url' in body));
});
test('wrong preference seller, currency, amount or checkout URL never reach the buyer', async () => {
  for (const mutate of [
    p => ({ ...p, collector_id: 326355222 }),
    p => ({ ...p, items: [{ ...p.items[0], unit_price: 0.01 }] }),
    p => ({ ...p, items: [{ ...p.items[0], currency_id: 'ARS' }] }),
    p => ({ ...p, init_point: 'https://untrusted.example/checkout/' }),
    p => ({ ...p, init_point: 'https://www.mercadopago.com.br:8443/checkout/?pref_id=' + id }),
    p => ({ ...p, init_point: 'https://user:pass@www.mercadopago.com.br/checkout/?pref_id=' + id }),
    p => ({ ...p, init_point: 'https://www.mercadopago.com.br/checkout/?pref_id=wrong' }),
  ]) {
    const r = await fixture({ mutate }).app.checkout(post({ packageId: 'conteudo', attemptId: randomUUID() }));
    assert.equal(r.statusCode, 502); assert.ok(!('checkoutUrl' in parse(r)));
  }
});
test('provider error responses do not leak credentials or personal data', async () => {
  const r = await fixture({ fail: true }).app.checkout(post({ packageId: 'conteudo', attemptId: randomUUID() }));
  assert.equal(r.statusCode, 502); assert.match(parse(r).error, /MP_HTTP_401/);
  assert.ok(!r.body.includes('private provider')); assert.ok(!r.body.includes(env.MERCADOPAGO_TEST_ACCESS_TOKEN));
});
test('receipt tampering, extra browser fields and expiry are rejected before lookups', async () => {
  const f = fixture(); const { receipt } = await start(f); const count = f.calls.length;
  assert.equal((await f.app.status(post({ receipt: receipt.slice(0, -5) + '00000' }))).statusCode, 401);
  assert.equal((await f.app.status(post({ receipt, paymentId: 'other' }))).statusCode, 400);
  const expired = createPayments({ env, now: () => now + 86400001 });
  assert.equal((await expired.status(post({ receipt }))).statusCode, 401);
  assert.equal(f.calls.length, count);
});
test('status is pending before payment, then checks the server payment and displays its ID', async () => {
  for (const [payment, expected] of [
    [null, 'pending'],
    [{ status: 'approved', status_detail: 'accredited' }, 'approved'],
    [{ status: 'approved', status_detail: 'accredited', transaction_amount_refunded: 1 }, 'pending'],
    [{ status: 'rejected' }, 'failed'],
    [{ status: 'refunded' }, 'failed'],
  ]) {
    const f = fixture(); const { receipt } = await start(f);
    if (payment) f.setPayments([payment]);
    const r = await f.app.status(post({ receipt }));
    assert.equal(r.statusCode, 200, r.body); assert.equal(parse(r).status, expected);
    assert.equal(parse(r).deliveryEnabled, false);
    assert.equal(parse(r).paymentId, payment ? '1234567890' : null);
    assert.equal(f.calls.at(-1).reference, f.preference.external_reference);
  }
});
test('live payments and mismatched seller, amount, currency or reference never approve', async () => {
  for (const payment of [{ live_mode: true }, { collector_id: 326355222 }, { transaction_amount: 0.01 }, { currency_id: 'ARS' }, { external_reference: 'foreign' }]) {
    const f = fixture(); const { receipt } = await start(f); f.setPayments([{ status: 'approved', status_detail: 'accredited', ...payment }]);
    const r = await f.app.status(post({ receipt })); assert.equal(r.statusCode, 502);
  }
});
function notification(body = {}) {
  const paymentId = '1234567890'; const requestId = randomUUID(); const ts = String(now);
  const hash = createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET).update('id:' + paymentId + ';request-id:' + requestId + ';ts:' + ts + ';').digest('hex');
  return { ...post({ type: 'payment', live_mode: false, data: { id: paymentId }, ...body }),
    headers: { 'content-type': 'application/json', 'x-request-id': requestId, 'x-signature': 'ts=' + ts + ',v1=' + hash },
    queryStringParameters: { type: 'payment', 'data.id': paymentId } };
}
test('webhooks require valid HMAC and matching IDs', async () => {
  const f = fixture(); const invalid = notification(); invalid.headers['x-signature'] += '00';
  assert.equal((await f.app.webhook(invalid)).statusCode, 401);
  assert.equal((await f.app.webhook(notification({ data: { id: 'other' } }))).statusCode, 400);
  assert.equal(f.calls.length, 0);
});
test('duplicate signed notifications acknowledge immediately without claiming payment approval or releasing files', async () => {
  const f = fixture();
  for (let i = 0; i < 2; i++) assert.deepEqual(parse(await f.app.webhook(notification())), { received: true, signatureVerified: true, mode: 'test', deliveryEnabled: false });
  assert.equal(parse(await f.app.webhook(notification({ live_mode: true }))).ignored, true);
  assert.equal(parse(await f.app.webhook(notification({ type: 'order' }))).ignored, true);
  assert.equal(f.calls.length, 0);
});
test('official SDK sends Preferences API contract and idempotency header', async () => {
  const originalFetch = globalThis.fetch; const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/users/me')) return Response.json({ id: 3877354270, site_id: 'MLB', tags: ['test_user'] });
    const body = JSON.parse(options.body);
    return Response.json({ ...body, id, collector_id: 3877354270, init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=' + id });
  };
  try {
    const attempt = randomUUID(); const app = createPayments({ env }); const r = await app.checkout(post({ packageId: 'conteudo', attemptId: attempt }));
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(new URL(calls[1].url).pathname.replace(/\/$/, ''), '/checkout/preferences');
    const headers = new Headers(calls[1].options.headers);
    assert.equal(headers.get('x-idempotency-key'), attempt);
  } finally { globalThis.fetch = originalFetch; }
});
