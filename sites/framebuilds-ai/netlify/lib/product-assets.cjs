'use strict';
const manifest = require('../../product-manifest.json');
function validAsset(asset) {
  return !!asset && /^[a-f0-9]{64}$/.test(asset.sha256 || '') && asset.key === 'packages/' + asset.sha256 + '.zip'
    && /^[a-z0-9-]+\.zip$/.test(asset.fileName || '') && Number.isSafeInteger(asset.size) && asset.size > 0 && asset.size <= 20 * 1024 * 1024;
}
function createProductAssets({ entries = manifest, store } = {}) {
  return {
    configured(id) { return validAsset(entries[id]); },
    async getAsset(id) {
      const asset = entries[id];
      if (!validAsset(asset)) return null;
      const actual = await store.getMetadata(asset.key);
      return actual?.metadata?.sha256 === asset.sha256 && actual.metadata.size === asset.size ? { ...asset } : null;
    },
    async stream(asset) {
      if (!validAsset(asset)) throw new Error('INVALID_ASSET');
      const actual = await store.getMetadata(asset.key);
      if (actual?.metadata?.sha256 !== asset.sha256 || actual.metadata.size !== asset.size) throw new Error('ASSET_NOT_AVAILABLE');
      const stream = await store.get(asset.key, { type: 'stream' });
      if (!stream) throw new Error('ASSET_NOT_AVAILABLE');
      return stream;
    },
  };
}
async function getProductAssets(event) {
  const { getStore, connectLambda } = await import('@netlify/blobs');
  if (event?.blobs) connectLambda(event);
  return createProductAssets({ store: getStore({ name: 'framebuilds-products', consistency: 'strong' }) });
}
module.exports = { createProductAssets, getProductAssets, validAsset };
