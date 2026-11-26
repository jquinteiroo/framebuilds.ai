'use strict';
// Temporary provisioning route. It can write only the five immutable archive
// versions in the manifest, never read files or modify orders/payments.
const { createHash, timingSafeEqual } = require('node:crypto');
const manifest = require('../../product-manifest.json');
const { validAsset } = require('../lib/product-assets.cjs');
function createProvisioner({ env = process.env, entries = manifest, storeFactory, now = Date.now } = {}) {
  return async event => {
    const reply = statusCode => ({ statusCode, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: statusCode === 200 }) });
    if (event.httpMethod !== 'POST') return reply(405);
    const secret = env.FRAMEBUILDS_UPLOAD_TOKEN || '';
    const expiry = Number(env.FRAMEBUILDS_UPLOAD_EXPIRES);
    if (secret.length < 64 || !Number.isFinite(expiry) || expiry <= now()) return reply(404);
    const authorization = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === 'authorization')?.[1] || '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(secret).digest())) return reply(401);
    const asset = entries[event.queryStringParameters?.packageId];
    if (!validAsset(asset) || typeof event.body !== 'string' || !event.isBase64Encoded || event.body.length > 150000) return reply(400);
    const data = Buffer.from(event.body, 'base64');
    if (data.length !== asset.size || data[0] !== 80 || data[1] !== 75 || createHash('sha256').update(data).digest('hex') !== asset.sha256) return reply(400);
    try {
      let store;
      if (storeFactory) store = await storeFactory();
      else {
        const { getStore, connectLambda } = await import('@netlify/blobs');
        if (event.blobs) connectLambda(event);
        store = getStore({ name: 'framebuilds-products', consistency: 'strong' });
      }
      await store.set(asset.key, data, { onlyIfNew: true, metadata: { sha256: asset.sha256, size: asset.size } });
      const saved = await store.getMetadata(asset.key);
      return reply(saved?.metadata?.sha256 === asset.sha256 && saved.metadata.size === asset.size ? 200 : 409);
    } catch { return reply(503); }
  };
}
exports.handler = createProvisioner();
exports.createProvisioner = createProvisioner;
