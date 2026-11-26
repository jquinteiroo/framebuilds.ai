const { test } = require('node:test');
const assert = require('node:assert/strict');
test('v2 adapter preserves raw webhook payload, signature headers and query IDs', async () => {
  const { adapt } = await import('../netlify/lib/function-adapter.mjs');
  const body = '{"type":"payment","data":{"id":"123"}}';
  const handler = adapt(async event => {
    assert.equal(event.body, body);
    assert.equal(event.headers['x-signature'], 'ts=123,v1=abc');
    assert.equal(event.queryStringParameters['data.id'], '123');
    assert.equal(event.httpMethod, 'POST');
    return { statusCode: 202, headers: { 'Cache-Control': 'no-store' }, body: '{"received":true}' };
  });
  const result = await handler(new Request('https://example.com/webhook?data.id=123', { method: 'POST', headers: { 'X-Signature': 'ts=123,v1=abc' }, body }));
  assert.equal(result.status, 202); assert.equal(result.headers.get('cache-control'), 'no-store'); assert.deepEqual(await result.json(), { received: true });
});
test('v2 configuration adapter handles GET without attempting to read a body', async () => {
  const { adapt } = await import('../netlify/lib/function-adapter.mjs');
  const handler = adapt(async event => { assert.equal(event.body, ''); return { statusCode: 200, body: '{}' }; });
  assert.equal((await handler(new Request('https://example.com/config'))).status, 200);
});
