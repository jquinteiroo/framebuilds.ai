'use strict';
// Test-only hosted Checkout Pro. Card data never passes through this server.
const { createHmac, timingSafeEqual } = require('node:crypto');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const catalog = require('../../packages.json');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PREFERENCE_ID = /^[a-z0-9_-]{8,150}$/i;
const PAYMENT_ID = /^\d{1,20}$/;
const packages = new Map(catalog.packages.map(pack => [pack.id, pack]));
class PaymentError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const response = (statusCode, body) => ({ statusCode, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}, body: JSON.stringify(body) });
const header = (event, name) => String(Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name)?.[1] || '');
function bodyOf(event, allowedKeys) {
  if (!header(event, 'content-type').toLowerCase().startsWith('application/json')) throw new PaymentError(415, 'Envie uma solicitação JSON.');
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
  if (Buffer.byteLength(raw) > 8192) throw new PaymentError(413, 'Solicitação muito grande.');
  let body;
  try { body = JSON.parse(raw); } catch { throw new PaymentError(400, 'Solicitação inválida.'); }
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new PaymentError(400, 'Solicitação inválida.');
  if (allowedKeys && Object.keys(body).some(key => !allowedKeys.includes(key))) throw new PaymentError(400, 'Parâmetros não permitidos.');
  return body;
}
function cents(value) {
  const match = String(value ?? '').match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);
  return match ? Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0')) : NaN;
}
function equalHex(actual, expected) {
  return typeof actual === 'string' && /^[a-f0-9]{64}$/i.test(actual) && timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
function createPayments({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now, provider } = {}) {
  const site = new URL(env.APP_URL || env.URL || 'http://localhost:3000');
  const publicAppUrl = site.protocol === 'https:' && !['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(site.hostname);
  const localAppUrl = site.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
  const token = env.MERCADOPAGO_TEST_ACCESS_TOKEN || '';
  const webhookSecret = env.MERCADOPAGO_WEBHOOK_SECRET || '';
  const receiptSecret = env.MERCADOPAGO_RECEIPT_SECRET || '';
  const sellerId = env.MERCADOPAGO_TEST_SELLER_ID || '';
  const enabled = env.MERCADOPAGO_TEST_ENABLED === 'true' && token.length > 10 && receiptSecret.length >= 32 && PAYMENT_ID.test(sellerId) && (publicAppUrl || localAppUrl);
  const webhookConfigured = webhookSecret.length >= 16;
  const client = new MercadoPagoConfig({ accessToken: token, options: { timeout: 8000, maxRetries: 0 } });
  const preferences = new Preference(client);
  const payments = new Payment(client);
  const gateway = provider || {
    createPreference: (body, idempotencyKey) => preferences.create({ body, requestOptions: { idempotencyKey } }),
    getPreference: id => preferences.get({ preferenceId: id }),
    findPayments: reference => payments.search({ options: { external_reference: reference, sort: 'date_created', criteria: 'desc', limit: 100 } }),
  };
  const requireReady = () => { if (!enabled) throw new PaymentError(503, 'O checkout de teste ainda não está disponível. Confira as variáveis no servidor.'); };
  const requirePost = event => { if (event.httpMethod !== 'POST') throw new PaymentError(405, 'Método não permitido.'); };
  const requireOrigin = event => { if (header(event, 'origin') !== site.origin) throw new PaymentError(403, 'Origem não permitida.'); };
  const hmac = value => createHmac('sha256', receiptSecret).update('framebuilds-receipt-v2:' + value).digest('hex');
  function signReceipt(claims) {
    const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return encoded + '.' + hmac(encoded);
  }
  function readReceipt(value) {
    if (typeof value !== 'string' || value.length > 4096) throw new PaymentError(401, 'Comprovante de teste inválido.');
    const [encoded, signature, extra] = value.split('.');
    if (!encoded || extra || !equalHex(signature, hmac(encoded))) throw new PaymentError(401, 'Comprovante de teste inválido.');
    let claims;
    try { claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { throw new PaymentError(401, 'Comprovante de teste inválido.'); }
    if (!claims || !PREFERENCE_ID.test(claims.preferenceId) || !packages.has(claims.packageId) || claims.sellerId !== sellerId || !Number.isSafeInteger(claims.priceCents) || claims.priceCents < 1 || !Number.isFinite(claims.expires) || claims.expires < now()) throw new PaymentError(401, 'Comprovante de teste expirado ou inválido. Inicie um novo teste.');
    return claims;
  }
  async function verifyTestSeller() {
    const result = await fetchImpl('https://api.mercadopago.com/users/me', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw { status: result.status };
    const seller = await result.json();
    if (String(seller.id) !== sellerId || seller.site_id !== 'MLB' || !Array.isArray(seller.tags) || !seller.tags.includes('test_user')) throw new PaymentError(503, 'Use somente as credenciais do vendedor de teste configurado (MP_SELLER_MODE).');
  }
  function inspectPreference(preference, claims) {
    const item = preference.items?.[0];
    if (preference.id !== claims.preferenceId || String(preference.collector_id) !== sellerId || preference.external_reference !== claims.reference || preference.items?.length !== 1 || !item || item.currency_id !== 'BRL' || item.quantity !== 1 || cents(item.unit_price) !== claims.priceCents) throw new PaymentError(502, 'A preferência retornada não corresponde a esta tentativa (MP_PREFERENCE_MISMATCH).');
  }
  function inspectPayment(payment, claims) {
    if (!PAYMENT_ID.test(String(payment.id)) || payment.live_mode !== false || String(payment.collector_id) !== sellerId || payment.currency_id !== 'BRL' || payment.external_reference !== claims.reference || cents(payment.transaction_amount) !== claims.priceCents) throw new PaymentError(502, 'O pagamento não corresponde a este teste (MP_PAYMENT_MISMATCH).');
    const approved = payment.status === 'approved' && payment.status_detail === 'accredited' && cents(payment.transaction_amount_refunded || 0) === 0;
    const failed = ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(payment.status);
    return { paymentId: String(payment.id), status: approved ? 'approved' : failed ? 'failed' : 'pending' };
  }
  const guarded = action => async event => {
    try { return await action(event); }
    catch (error) {
      if (error instanceof PaymentError) return response(error.status, { error: error.message });
      const status = Number(error.status || error.statusCode || error.cause?.status);
      const advice = status === 401 ? 'Confira o Access Token de teste no servidor.' : status === 429 ? 'Aguarde alguns instantes e tente novamente.' : 'Confira a configuração e tente novamente.';
      const code = Number.isInteger(status) && status >= 400 && status <= 599 ? ' (MP_HTTP_' + status + ')' : '';
      return response(status === 429 ? 503 : 502, { error: 'Não foi possível consultar o Mercado Pago' + code + '. ' + advice });
    }
  };
  return {
    config: guarded(event => {
      if (event.httpMethod !== 'GET') throw new PaymentError(405, 'Método não permitido.');
      return response(200, { enabled, mode: 'test', livePaymentsEnabled: false, deliveryEnabled: false, webhookConfigured });
    }),
    checkout: guarded(async event => {
      requirePost(event); requireReady(); requireOrigin(event);
      const input = bodyOf(event, ['packageId', 'attemptId']);
      const pack = packages.get(input.packageId);
      if (!pack || !UUID.test(input.attemptId)) throw new PaymentError(400, 'Pacote ou tentativa inválida.');
      // Fail before creating a preference if a real seller token was supplied.
      await verifyTestSeller();
      const reference = 'fb_' + pack.id + '_' + input.attemptId;
      const back = site.origin + '/pagamento.html';
      const publicAppUrl = /^https:\/\//i.test(site.origin) && !/^https:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(site.origin);
      const preference = await gateway.createPreference({
        items: [{ id: pack.id, title: pack.name, description: 'Pacote digital framebuilds.ai — ' + pack.name, quantity: 1, unit_price: pack.priceCents / 100, currency_id: 'BRL' }],
        back_urls: { success: back, failure: back, pending: back },
        ...(publicAppUrl ? { auto_return: 'approved' } : {}),
        ...(publicAppUrl && webhookConfigured ? { notification_url: site.origin + '/.netlify/functions/mercadopago-webhook' } : {}),
        external_reference: reference, statement_descriptor: 'FRAMEBUILDS',
      }, input.attemptId);
      const claims = { preferenceId: preference.id, packageId: pack.id, priceCents: pack.priceCents, sellerId, reference, expires: now() + 86400000 };
      inspectPreference(preference, claims);
      let url;
      try { url = new URL(preference.init_point); } catch { throw new PaymentError(502, 'O checkout de teste não foi criado.'); }
      if (!PREFERENCE_ID.test(preference.id) || url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.br' || url.username || url.password || url.port || !url.pathname.startsWith('/checkout/') || url.searchParams.get('pref_id') !== preference.id) throw new PaymentError(502, 'O endereço do checkout de teste não é válido.');
      return response(200, { checkoutUrl: url.href, receipt: signReceipt(claims), mode: 'test' });
    }),
    status: guarded(async event => {
      requirePost(event); requireReady(); requireOrigin(event);
      const claims = readReceipt(bodyOf(event, ['receipt']).receipt);
      inspectPreference(await gateway.getPreference(claims.preferenceId), claims);
      const result = await gateway.findPayments(claims.reference);
      if (!Array.isArray(result.results)) throw new PaymentError(502, 'Resposta de pagamento inválida.');
      const found = result.results.map(payment => inspectPayment(payment, claims));
      const selected = found.find(p => p.status === 'approved') || found.find(p => p.status === 'pending') || found[0];
      return response(200, { mode: 'test', packageName: packages.get(claims.packageId).name, priceCents: claims.priceCents,
        status: selected?.status || 'pending', paymentId: selected?.paymentId || null, deliveryEnabled: false });
    }),
    webhook: guarded(event => {
      if (event.httpMethod === 'GET') return response(200, { mode: 'test', configured: webhookConfigured });
      requirePost(event);
      if (!webhookConfigured) throw new PaymentError(503, 'A assinatura do webhook não está configurada.');
      const query = event.queryStringParameters || {};
      const id = query['data.id'];
      const requestId = header(event, 'x-request-id');
      const parts = header(event, 'x-signature').split(',').map(part => part.trim().split('=').map(value => value.trim()));
      const ts = parts.find(([key]) => key === 'ts')?.[1];
      const hashes = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
      if (!PAYMENT_ID.test(id || '') || !/^[a-z0-9-]{1,100}$/i.test(requestId) || !/^\d{10,13}$/.test(ts || '')) throw new PaymentError(401, 'Notificação não autenticada.');
      const canonical = 'id:' + id + ';request-id:' + requestId + ';ts:' + ts + ';';
      const expected = createHmac('sha256', webhookSecret).update(canonical).digest('hex');
      if (!hashes.some(hash => equalHex(hash, expected))) throw new PaymentError(401, 'Notificação não autenticada.');
      const input = bodyOf(event);
      if (String(input.data?.id) !== id) throw new PaymentError(400, 'Identificadores da notificação não correspondem.');
      if (input.type !== 'payment' || (query.type && query.type !== 'payment') || input.live_mode !== false) return response(200, { received: true, ignored: true });
      // Acknowledge immediately; this test stage has no fulfillment side effects.
      // The status endpoint independently re-reads payments. Production requires
      // a durable queue; work after a classic Function response is not reliable.
      return response(200, { received: true, signatureVerified: true, mode: 'test', deliveryEnabled: false });
    }),
  };
}
module.exports = { createPayments, cents };
