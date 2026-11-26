'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = readFileSync(require.resolve('../dist/checkout.js'), 'utf8');
const catalog = require('../packages.json');
const configured = { enabled: true, mode: 'test', livePaymentsEnabled: false, deliveryEnabled: false };
const checkoutUrl = 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=3877354270-12345678-1234-4234-8234-123456789abc';

// Minimal DOM boundary; the actual checkout script, events, fetches and redirects run unchanged.
function element() {
  return { hidden: false, disabled: false, open: false, textContent: '', children: [], handlers: {},
    addEventListener(name, handler) { this.handlers[name] = handler; },
    append(...children) { this.children.push(...children); },
    prepend(...children) { this.children.unshift(...children); },
    replaceChildren(...children) { this.children = children; },
    showModal() { this.open = true; },
    close() { this.open = false; this.handlers.close?.(); },
    async click() { if (!this.disabled && !this.hidden) await this.handlers.click?.({ preventDefault() {} }); },
  };
}
function browser({ query = '', stored = new Map(), fetchImpl, blockedStorage = false, crypto = webcrypto, timer = setTimeout, cancelTimer = clearTimeout } = {}) {
  const nodes = new Map();
  const document = { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); }, createElement: element };
  const calls = []; const redirects = [];
  const location = { href: `https://framebuildsai.netlify.app/${query}`, search: query.split('#')[0], assign(url) { redirects.push(url); } };
  const window = { FRAMEBUILDS_STORE: catalog };
  const sessionStorage = {
    getItem(key) { if (blockedStorage) throw new Error('blocked'); return stored.get(key); },
    setItem(key, value) { if (blockedStorage) throw new Error('blocked'); stored.set(key, value); },
    removeItem(key) { if (blockedStorage) throw new Error('blocked'); stored.delete(key); },
  };
  const fetch = async (url, options) => {
    calls.push({ url, options });
    return fetchImpl ? fetchImpl(url, options) : Response.json(url.endsWith('payment-config') ? configured : { mode: 'test', receipt: 'signed-test-receipt', checkoutUrl });
  };
  runInNewContext(source, { window, document, location, history: { replaceState(_state, _unused, url) { location.href = url; } }, sessionStorage, URL, URLSearchParams, Intl, crypto, fetch, AbortController, AbortSignal, setTimeout: timer, clearTimeout: cancelTimer });
  return { node: selector => document.querySelector(selector), calls, redirects, stored, location, open: window.FRAMEBUILDS_CHECKOUT.openPurchase };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('normal storefront keeps a visible entry to test mode and does not request checkout', async () => {
  const b = browser(); b.open('conteudo');
  assert.equal(b.node('#purchase-dialog').open, true);
  assert.equal(b.node('#checkout-action').hidden, true);
  assert.equal(b.node('#checkout-test-entry').hidden, false);
  assert.equal(b.calls.length, 0);
  await b.node('#checkout-test-entry').click(); await settle();
  assert.equal(b.node('#checkout-action').hidden, false);
  assert.equal(b.node('#checkout-action').disabled, false);
  assert.match(b.location.href, /checkout=test/);
  assert.equal(b.calls[0].url, '/.netlify/functions/payment-config');
});
test('test mode survives navigation without query parameters in the same tab and can be exited', async () => {
  const first = browser({ query: '?checkout=test' }); await settle();
  const next = browser({ stored: first.stored }); await settle(); next.open('video');
  assert.equal(next.node('#checkout-action').hidden, false);
  assert.match(next.node('#checkout-action').textContent, /Pagar com Mercado Pago/);
  const exited = browser({ query: '?checkout=off', stored: first.stored }); exited.open('conteudo');
  assert.equal(exited.node('#checkout-action').hidden, true);
  assert.equal(exited.stored.has('framebuilds:checkout-test-mode'), false);
});
test('click creates a test checkout for the selected package, stores its receipt and redirects', async () => {
  const b = browser({ query: '?checkout=test' }); await settle(); b.open('completo');
  await b.node('#checkout-action').click();
  assert.deepEqual(b.redirects, [checkoutUrl]);
  assert.equal(b.stored.get('framebuilds:checkout-test'), 'signed-test-receipt');
  const sent = JSON.parse(b.calls[1].options.body);
  assert.equal(sent.packageId, 'completo');
  assert.match(sent.attemptId, /^[\da-f-]{36}$/i);
  assert.deepEqual(Object.keys(sent).sort(), ['attemptId', 'packageId']);
});
test('configuration failure stays visible and can be retried without reloading', async () => {
  let first = true;
  const b = browser({ query: '?checkout=test', fetchImpl: async () => {
    if (first) { first = false; throw new Error('Conexão indisponível'); }
    return Response.json(configured);
  } });
  await settle(); b.open('conteudo');
  assert.match(b.node('#checkout-status').textContent, /Conexão indisponível/);
  assert.equal(b.node('#checkout-action').disabled, false);
  await b.node('#checkout-action').click();
  assert.match(b.node('#checkout-action').textContent, /Pagar com Mercado Pago/);
  assert.equal(b.calls.length, 2);
});
test('HTML server errors and provider errors remain visible and retries use the same attempt', async () => {
  for (const failure of [new Response('<html>Function error</html>', { status: 502 }), Response.json({ error: 'Falha no Mercado Pago (MP_HTTP_401).' }, { status: 502 })]) {
    const b = browser({ query: '?checkout=test', fetchImpl: async url => url.endsWith('payment-config') ? Response.json(configured) : failure.clone() });
    await settle(); b.open('conteudo');
    await b.node('#checkout-action').click();
    assert.match(b.node('#checkout-status').textContent, /HTTP 502|MP_HTTP_401/);
    assert.equal(b.node('#checkout-action').disabled, false);
    await b.node('#checkout-action').click();
    assert.equal(b.calls[1].options.body, b.calls[2].options.body);
    assert.equal(b.redirects.length, 0);
  }
});
test('a hung checkout times out with an actionable message and enables retry', async () => {
  let expire;
  const b = browser({ query: '?checkout=test', timer: fn => { expire = fn; return 1; }, cancelTimer: () => {}, fetchImpl: async (url, options) => {
    if (url.endsWith('payment-config')) return Response.json(configured);
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  } });
  await settle(); b.open('conteudo');
  const pending = b.node('#checkout-action').click();
  assert.equal(b.node('#checkout-action').disabled, true);
  expire(); await pending;
  assert.match(b.node('#checkout-status').textContent, /demorou demais/);
  assert.equal(b.node('#checkout-action').disabled, false);
});
test('unavailable storage or UUID generation shows an error instead of a silent click', async () => {
  for (const options of [{ blockedStorage: true }, { crypto: { randomUUID() { throw new Error('Identificador indisponível'); } } }]) {
    const b = browser({ query: '?checkout=test', ...options }); await settle();
    b.open('conteudo');
    assert.equal(b.node('#purchase-dialog').open, true);
    await b.node('#checkout-action').click();
    assert.match(b.node('#checkout-status').textContent, /armazenamento|Identificador indisponível/);
    assert.equal(b.node('#checkout-action').disabled, false);
    assert.equal(b.redirects.length, 0);
  }
});
test('closing a pending checkout cancels navigation even if a response arrives later', async () => {
  let respond;
  const b = browser({ query: '?checkout=test', fetchImpl: async url => url.endsWith('payment-config') ? Response.json(configured) : new Promise(resolve => { respond = resolve; }) });
  await settle(); b.open('conteudo');
  const pending = b.node('#checkout-action').click();
  b.node('#purchase-dialog').close();
  respond(Response.json({ mode: 'test', receipt: 'receipt', checkoutUrl })); await pending;
  assert.equal(b.redirects.length, 0);
});
