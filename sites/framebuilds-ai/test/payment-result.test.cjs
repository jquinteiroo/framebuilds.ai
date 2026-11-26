'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync(require.resolve('../dist/payment-result.js'), 'utf8');
function browser({ data = {}, receipt = 'signed-private-access', hash = '', responseStatus = 200 } = {}) {
  const nodes = new Map(), calls = [], clicked = [];
  function element() { return { hidden: false, disabled: false, textContent: '', handlers: {}, addEventListener(n, h) { this.handlers[n] = h; }, click() { if (this.handlers.click) return this.handlers.click(); clicked.push(this); } }; }
  const document = { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); }, createElement: element };
  const stored = new Map([['framebuilds:last-checkout-mode', 'production'], ['framebuilds:checkout-live', receipt]]);
  const location = { hash, pathname: '/pagamento.html', origin: 'https://framebuildsai.netlify.app' };
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('download')) return new Response(new Uint8Array([80, 75]), { headers: { 'content-disposition': 'attachment; filename=\"conteudo.zip\"' } });
    return Response.json({ mode: 'production', status: 'approved', deliveryEnabled: true, packageName: 'Conteúdo', priceCents: 1990, paymentId: '123', ...data }, { status: responseStatus });
  };
  class LocalURL extends URL {}
  LocalURL.createObjectURL = () => 'blob:private-file';
  LocalURL.revokeObjectURL = () => {};
  runInNewContext(source, { document, location, history: { replaceState(_a, _b, path) { location.hash = ''; } }, sessionStorage: { getItem: k => stored.get(k), setItem: (k,v) => stored.set(k,v) }, fetch, URL: LocalURL, URLSearchParams, Intl, AbortSignal, setTimeout: () => 1 });
  return { node: selector => document.querySelector(selector), calls, stored, location, clicked };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('test approval never reveals a download button', async () => {
  const b = browser({ data: { mode: 'test', status: 'approved', deliveryEnabled: false } }); await settle();
  assert.equal(b.node('#result-download').hidden, true);
  assert.equal(b.node('#result-access').hidden, true);
  assert.equal(b.node('#result-test-note').hidden, false);
});
test('pending and revoked payments cannot download', async () => {
  for (const status of ['pending', 'refunded', 'disputed', 'failed']) {
    const b = browser({ data: { status, deliveryEnabled: false } }); await settle();
    assert.equal(b.node('#result-download').hidden, true);
  }
});
test('approved production delivery sends the capability in a header and downloads the file', async () => {
  const b = browser(); await settle();
  assert.equal(b.node('#result-download').hidden, false);
  assert.match(b.node('#result-access').href, /#acesso=/);
  await b.node('#result-download').click();
  assert.equal(b.calls[1].url, '/.netlify/functions/download');
  assert.equal(b.calls[1].options.headers.Authorization, 'Bearer signed-private-access');
  assert.equal(b.clicked[0].download, 'conteudo.zip');
});
test('a saved access fragment restores the receipt and is removed from the address bar', async () => {
  const b = browser({ hash: '#acesso=restored-signed-receipt' }); await settle();
  assert.equal(b.stored.get('framebuilds:checkout-live'), 'restored-signed-receipt');
  assert.equal(b.location.hash, '');
  assert.equal(JSON.parse(b.calls[0].options.body).receipt, 'restored-signed-receipt');
});
test('a rejected receipt displays an error and never offers a download', async () => {
  const b = browser({ data: { error: 'Link expirado.' }, responseStatus: 401 }); await settle();
  assert.equal(b.node('#result-download').hidden, true);
  assert.match(b.node('#result-description').textContent, /Link expirado/);
});
