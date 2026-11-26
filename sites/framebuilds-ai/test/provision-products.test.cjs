'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createProvisioner } = require('../netlify/functions/provision-products.cjs');
const data = Buffer.from('PK-test-private-archive');
const sha256 = createHash('sha256').update(data).digest('hex');
const asset = { key: 'packages/' + sha256 + '.zip', sha256, size: data.length, fileName: 'conteudo.zip' };
const env = { FRAMEBUILDS_UPLOAD_TOKEN: 'a'.repeat(64), FRAMEBUILDS_UPLOAD_EXPIRES: '2000' };
const event = { httpMethod: 'POST', headers: { authorization: 'Bearer ' + env.FRAMEBUILDS_UPLOAD_TOKEN }, queryStringParameters: { packageId: 'conteudo' }, isBase64Encoded: true, body: data.toString('base64') };
function setup(override = {}) {
  let writes = 0;
  const handler = createProvisioner({ env, entries: { conteudo: asset }, now: () => 1000,
    storeFactory: async () => ({ set: async () => { writes++; }, getMetadata: async () => ({ metadata: { sha256, size: data.length } }) }), ...override });
  return { handler, writes: () => writes };
}
test('provisioning is disabled without a strong unexpired token', async () => {
  for (const config of [{}, { ...env, FRAMEBUILDS_UPLOAD_TOKEN: 'short' }, { ...env, FRAMEBUILDS_UPLOAD_EXPIRES: '999' }]) {
    const s = setup({ env: config }); assert.equal((await s.handler(event)).statusCode, 404); assert.equal(s.writes(), 0);
  }
});
test('provisioning authenticates before writing and never serves downloads', async () => {
  const s = setup();
  assert.equal((await s.handler({ ...event, headers: {} })).statusCode, 401);
  assert.equal((await s.handler({ ...event, httpMethod: 'GET' })).statusCode, 405);
  assert.equal(s.writes(), 0);
});
test('provisioning rejects unknown packages and modified or oversized archives', async () => {
  const s = setup();
  for (const override of [{ queryStringParameters: { packageId: '../secret' } }, { body: Buffer.from('PK-forged').toString('base64') }, { body: 'a'.repeat(150001) }, { isBase64Encoded: false }]) assert.equal((await s.handler({ ...event, ...override })).statusCode, 400);
  assert.equal(s.writes(), 0);
});
test('provisioning writes only a manifest-matching immutable private archive', async () => {
  const s = setup(); assert.equal((await s.handler(event)).statusCode, 200); assert.equal(s.writes(), 1);
});
