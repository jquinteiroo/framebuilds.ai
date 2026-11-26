'use strict';
const { validAsset } = require('../netlify/lib/product-assets.cjs');
const manifest = require('../product-manifest.json');
const catalogue = require('../packages.json');
const { getOrderRepository } = require('../netlify/lib/order-repository.cjs');
async function checkProduction(env = process.env) {
  const missing = [];
  for (const key of ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_SELLER_ID', 'MERCADOPAGO_ORDER_SECRET', 'MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET']) if (!env[key]) missing.push(key);
  if (env.MERCADOPAGO_ORDER_SECRET && env.MERCADOPAGO_ORDER_SECRET.length < 64) missing.push('MERCADOPAGO_ORDER_SECRET deve ter pelo menos 64 caracteres');
  if (env.MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET && env.MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET.length < 32) missing.push('Assinatura de produção incompleta');
  const missingProducts = catalogue.packages.filter(p => !validAsset(manifest[p.id])).map(p => p.id);
  if (missingProducts.length) missing.push('Arquivos privados: ' + missingProducts.join(', '));
  let databaseVerified = false, sellerVerified = false, assetStorageVerified = false;
  if (!missingProducts.length) {
    try {
      const { getStore } = await import('@netlify/blobs');
      const { createProductAssets } = require('../netlify/lib/product-assets.cjs');
      const store = getStore({ name: 'framebuilds-products', consistency: 'strong',
        ...(env.NETLIFY_SITE_ID && env.NETLIFY_AUTH_TOKEN ? { siteID: env.NETLIFY_SITE_ID, token: env.NETLIFY_AUTH_TOKEN } : {}) });
      const assets = createProductAssets({ store });
      assetStorageVerified = (await Promise.all(catalogue.packages.map(p => assets.getAsset(p.id)))).every(Boolean);
      if (!assetStorageVerified) missing.push('Arquivos do manifesto não encontrados no armazenamento privado');
    } catch { missing.push('Armazenamento privado não verificado'); }
  }
  if (env.NETLIFY_DB_URL) {
    try { databaseVerified = await (await getOrderRepository(env)).ready(); } catch { missing.push('Banco de pedidos ou migração indisponível'); }
  } else missing.push('NETLIFY_DB_URL');
  if (env.MERCADOPAGO_ACCESS_TOKEN && env.MERCADOPAGO_SELLER_ID) {
    try {
      const response = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: 'Bearer ' + env.MERCADOPAGO_ACCESS_TOKEN }, redirect: 'error', signal: AbortSignal.timeout(5000) });
      const seller = response.ok ? await response.json() : null;
      sellerVerified = !!seller && String(seller.id) === env.MERCADOPAGO_SELLER_ID && seller.site_id === 'MLB' && Array.isArray(seller.tags) && !seller.tags.includes('test_user');
      if (!sellerVerified) missing.push('Credenciais do vendedor real não confirmadas');
    } catch { missing.push('Não foi possível verificar o vendedor real'); }
  }
  return { configured: missing.length === 0, databaseVerified, sellerVerified, assetStorageVerified, missing,
    releaseSwitches: { mode: env.MERCADOPAGO_MODE || 'test', liveEnabled: env.MERCADOPAGO_LIVE_ENABLED === 'true', catalogueOpen: catalogue.salesOpen === true },
    paidTestAndWebhookVerified: false, realChargeCreated: false };
}
module.exports = { checkProduction };
if (require.main === module) checkProduction().then(result => { console.log(JSON.stringify(result, null, 2)); process.exitCode = result.configured ? 0 : 1; }).catch(() => { console.error('Não foi possível verificar a preparação de produção.'); process.exitCode = 1; });
