'use strict';
// Test-only Checkout Pro / Orders API. No card data, fulfillment or live checkout.
const { createHmac, timingSafeEqual } = require('node:crypto');
const catalog = require('../../packages.json');
const TEST_ORDER = /^ORDTST[A-Z0-9]{10,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const packages = new Map(catalog.packages.map(pack => [pack.id, pack]));

class PaymentError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const response = (statusCode, body) => ({ statusCode, headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
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

function createPayments({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const site = new URL(env.URL || 'https://framebuildsai.netlify.app');
  const token = env.MERCADOPAGO_TEST_ACCESS_TOKEN || '';
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET || '';
  const enabled = env.MERCADOPAGO_TEST_ENABLED === 'true' && token.length > 10 && secret.length >= 16 && site.protocol === 'https:';
  const requireReady = () => { if (!enabled) throw new PaymentError(503, 'O checkout de teste ainda não está disponível.'); };
  const requirePost = event => {
    if (event.httpMethod !== 'POST') throw new PaymentError(405, 'Método não permitido.');
  };
  const requireOrigin = event => {
    if (header(event, 'origin') !== site.origin) throw new PaymentError(403, 'Origem não permitida.');
  };
  const hmac = value => createHmac('sha256', secret).update(`framebuilds-receipt-v1:${value}`).digest('hex');
  function signReceipt(claims) {
    const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${encoded}.${hmac(encoded)}`;
  }
  function readReceipt(value) {
    if (typeof value !== 'string' || value.length > 4096) throw new PaymentError(401, 'Comprovante de teste inválido.');
    const [encoded, signature, extra] = value.split('.');
    if (!encoded || extra || !equalHex(signature, hmac(encoded))) throw new PaymentError(401, 'Comprovante de teste inválido.');
    let claims;
    try { claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { throw new PaymentError(401, 'Comprovante de teste inválido.'); }
    if (!claims || !TEST_ORDER.test(claims.orderId) || !packages.has(claims.packageId) || !Number.isSafeInteger(claims.priceCents) || claims.priceCents < 1 || !Number.isFinite(claims.expires) || claims.expires < now()) throw new PaymentError(401, 'Comprovante de teste expirado ou inválido.');
    return claims;
  }
  async function api(path, { method = 'GET', body, idempotencyKey } = {}) {
    let res;
    try {
      res = await fetchImpl(`https://api.mercadopago.com${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
        }, ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new PaymentError(502, 'Não foi possível consultar o Mercado Pago. Tente novamente.'); }
    if (!res.ok) throw new PaymentError(res.status === 429 ? 503 : 502, 'O Mercado Pago não concluiu a solicitação de teste. Verifique a configuração e tente novamente.');
    try { return await res.json(); } catch { throw new PaymentError(502, 'Resposta inválida do serviço de pagamento.'); }
  }
  function inspectOrder(order, claims) {
    if (!TEST_ORDER.test(order.id) || order.id !== claims.orderId || order.currency !== 'BRL' || order.external_reference !== claims.reference || cents(order.total_amount) !== claims.priceCents) throw new PaymentError(502, 'O pedido retornado não corresponde a esta tentativa de teste.');
    const approved = order.status === 'processed' && order.status_detail === 'accredited' && cents(order.total_paid_amount) === claims.priceCents;
    const failed = ['failed', 'canceled', 'cancelled', 'expired', 'refunded', 'charged_back'].includes(order.status);
    return { mode: 'test', packageName: packages.get(claims.packageId).name, priceCents: claims.priceCents,
      status: approved ? 'approved' : failed ? 'failed' : 'pending', deliveryEnabled: false };
  }
  const guarded = action => async event => {
    try { return await action(event); }
    catch (error) { return response(error instanceof PaymentError ? error.status : 500, { error: error instanceof PaymentError ? error.message : 'Não foi possível concluir a solicitação.' }); }
  };
  return {
    config: guarded(event => {
      if (event.httpMethod !== 'GET') throw new PaymentError(405, 'Método não permitido.');
      return response(200, { enabled, mode: 'test', livePaymentsEnabled: false, deliveryEnabled: false });
    }),
    checkout: guarded(async event => {
      requirePost(event); requireReady(); requireOrigin(event);
      const input = bodyOf(event, ['packageId', 'attemptId']);
      const pack = packages.get(input.packageId);
      if (!pack || !UUID.test(input.attemptId)) throw new PaymentError(400, 'Pacote ou tentativa inválida.');
      const reference = `fb:${pack.id}:${input.attemptId}`;
      const back = `${site.origin}/pagamento.html`;
      const order = await api('/v1/orders', { method: 'POST', idempotencyKey: input.attemptId, body: {
        type: 'online', processing_mode: 'manual', capture_mode: 'automatic_async',
        total_amount: (pack.priceCents / 100).toFixed(2), external_reference: reference,
        description: `framebuilds.ai - ${pack.name}`, expiration_time: 'P1D',
        items: [{ title: pack.name, quantity: 1, unit_price: (pack.priceCents / 100).toFixed(2) }],
        config: { online: { success_url: back, failure_url: back, pending_url: back, auto_return: 'all' } },
      } });
      // A test token must create an ORDTST order. Never hand out a live checkout URL.
      const claims = { orderId: order.id, packageId: pack.id, priceCents: pack.priceCents, reference, expires: now() + 86400000 };
      inspectOrder(order, claims);
      let url;
      try { url = new URL(order.checkout_url); } catch { throw new PaymentError(502, 'O checkout de teste não foi criado.'); }
      if (url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.br' || url.username || url.password || url.port || !url.pathname.startsWith('/checkout/') || url.searchParams.get('order_id') !== order.id) throw new PaymentError(502, 'O endereço do checkout de teste não é válido.');
      return response(200, { checkoutUrl: url.href, receipt: signReceipt(claims), mode: 'test' });
    }),
    status: guarded(async event => {
      requirePost(event); requireReady(); requireOrigin(event);
      const input = bodyOf(event, ['receipt']);
      const claims = readReceipt(input.receipt);
      const order = await api(`/v1/orders/${claims.orderId}`);
      return response(200, inspectOrder(order, claims));
    }),
    webhook: guarded(async event => {
      if (event.httpMethod === 'GET') return response(200, { mode: 'test', configured: enabled });
      requirePost(event); requireReady();
      const query = event.queryStringParameters || {};
      const id = query['data.id'];
      const requestId = header(event, 'x-request-id');
      const signature = header(event, 'x-signature');
      const fields = signature.split(',').map(part => part.trim().split('='));
      const ts = fields.find(([key]) => key === 'ts')?.[1];
      const hashes = fields.filter(([key]) => key === 'v1').map(([, value]) => value);
      if (!id || !/^[a-z0-9]{1,80}$/i.test(id) || !requestId || !/^[a-z0-9-]{1,100}$/i.test(requestId) || !/^\d{10,13}$/.test(ts || '')) throw new PaymentError(401, 'Notificação não autenticada.');
      const manifest = `id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`;
      const expected = createHmac('sha256', secret).update(manifest).digest('hex');
      if (!hashes.some(hash => equalHex(hash, expected))) throw new PaymentError(401, 'Notificação não autenticada.');
      // No fulfillment side effects: retries are safe and do not create grants.
      const input = bodyOf(event);
      if (input.type !== 'order' || query.type !== 'order' || input.live_mode !== false || !TEST_ORDER.test(id)) return response(200, { received: true, ignored: true });
      if (String(input.data?.id).toLowerCase() !== id.toLowerCase()) throw new PaymentError(400, 'Identificadores da notificação não correspondem.');
      const order = await api(`/v1/orders/${id}`);
      if (!TEST_ORDER.test(order.id) || order.id.toLowerCase() !== id.toLowerCase()) throw new PaymentError(502, 'Pedido de teste inválido.');
      // A valid signature alone never means a payment is approved, and no files
      // are released here. A durable order/fulfillment store is a separate step.
      return response(200, { received: true, verified: true, mode: 'test', deliveryEnabled: false });
    }),
  };
}
module.exports = { createPayments, cents };
