'use strict';
(() => {
  const packs = new Map(window.FRAMEBUILDS_STORE.packages.map(pack => [pack.id, pack]));
  const dialog = document.querySelector('#purchase-dialog');
  const action = document.querySelector('#checkout-action');
  const status = document.querySelector('#checkout-status');
  const entry = document.querySelector('#checkout-test-entry');
  const modeKey = 'framebuilds:checkout-test-mode';
  const requested = new URLSearchParams(location.search).get('checkout');
  let remembered = false;
  try { remembered = sessionStorage.getItem(modeKey) === 'true'; } catch {}
  let testing = requested === 'test' || (requested !== 'off' && remembered);
  const salesOpen = window.FRAMEBUILDS_STORE.salesOpen === true;
  let ready = false;
  let loading = false;
  let configMessage = '';
  let packageId = null;
  let attemptId = null;
  let activeRequest = null;
  let banner = null;

  function rememberMode() {
    try {
      if (testing) sessionStorage.setItem(modeKey, 'true');
      else sessionStorage.removeItem(modeKey);
    } catch {}
  }
  rememberMode();
  function showBanner() {
    if (banner) return;
    banner = document.createElement('div');
    banner.className = 'checkout-test-banner';
    const label = document.createElement('span');
    label.textContent = 'Ambiente de testes · Compras de teste não liberam arquivos.';
    const exit = document.createElement('a');
    exit.href = '/?checkout=off#pacote';
    exit.textContent = 'Sair do teste';
    banner.append(label, exit);
    document.querySelector('main').prepend(banner);
  }
  function render() {
    action.hidden = !testing && !salesOpen;
    entry.hidden = testing || salesOpen;
    action.disabled = loading || !!activeRequest;
    action.textContent = activeRequest ? 'Preparando checkout...' : loading ? 'Verificando pagamento...' : ready ? `Pagar com Mercado Pago${testing ? ' · teste' : ''} ↗` : 'Verificar disponibilidade ↻';
  }
  async function loadConfig() {
    if (loading) return;
    loading = true;
    ready = false;
    configMessage = 'Verificando a disponibilidade do pagamento...';
    status.textContent = configMessage;
    render();
    try {
      const response = await fetch('/.netlify/functions/payment-config', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      let config;
      try { config = await response.json(); } catch { throw new Error('A configuração não retornou uma resposta válida. Confira o deploy no Netlify e tente novamente.'); }
      if (!response.ok) throw new Error(`Não foi possível verificar a configuração (HTTP ${response.status}). Tente novamente.`);
      ready = config?.enabled === true && (testing ? config.mode === 'test' && config.livePaymentsEnabled === false : config.mode === 'production' && config.livePaymentsEnabled === true && config.deliveryEnabled === true);
      configMessage = ready ? testing ? 'Pronto para testar. Nenhuma compra real será habilitada.' : 'Você pagará no Mercado Pago. O arquivo será liberado após a confirmação.' : 'O pagamento ainda não está disponível. Tente novamente mais tarde.';
    } catch (error) {
      configMessage = error.name === 'TimeoutError' ? 'A verificação demorou demais. Tente novamente.' : error.message || 'Não foi possível verificar o pagamento. Tente novamente.';
    } finally {
      loading = false;
      status.textContent = configMessage;
      render();
    }
  }
  function openPurchase(id) {
    const pack = packs.get(id);
    if (!pack) return;
    packageId = id;
    attemptId = null;
    const details = document.querySelector('#package-dialog');
    if (details.open) details.close();
    document.querySelector('#purchase-title').textContent = pack.name;
    const description = document.querySelector('#purchase-description');
    const price = document.createElement('strong');
    price.textContent = `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pack.priceCents / 100)}, em pagamento único.`;
    description.replaceChildren('Este pacote custa ', price, testing ? ' Este é um checkout de teste e não libera o pacote.' : salesOpen ? ' Após a confirmação, baixe o ZIP na página do pedido. Guarde seu link privado de acesso, válido por 30 dias desde o início da compra.' : ' As vendas ainda não estão abertas.');
    status.textContent = testing || salesOpen ? configMessage : '';
    render();
    dialog.showModal();
  }
  entry.addEventListener('click', event => {
    event.preventDefault();
    testing = true;
    rememberMode();
    const url = new URL(location.href);
    url.searchParams.set('checkout', 'test');
    history.replaceState(null, '', url.href);
    showBanner();
    openPurchase(packageId);
    loadConfig();
  });
  action.addEventListener('click', async event => {
    event.preventDefault();
    if ((!testing && !salesOpen) || loading || activeRequest) return;
    if (!ready) { await loadConfig(); return; }
    const controller = new AbortController();
    activeRequest = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    status.textContent = testing ? 'Criando seu pedido de teste no Mercado Pago...' : 'Preparando seu pagamento no Mercado Pago...';
    render();
    try {
      attemptId ||= crypto.randomUUID();
      const response = await fetch('/.netlify/functions/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, attemptId }), signal: controller.signal,
      });
      let data;
      try { data = await response.json(); } catch { throw new Error(`O servidor não retornou uma resposta válida (HTTP ${response.status}). Confira o deploy no Netlify e tente novamente.`); }
      if (!response.ok) throw new Error(data.error || `Não foi possível abrir o checkout (HTTP ${response.status}).`);
      const url = new URL(data.checkoutUrl);
      if (data.mode !== (testing ? 'test' : 'production') || !data.receipt || url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.br' || url.username || url.password || url.port || !url.pathname.startsWith('/checkout/')) throw new Error('O endereço do checkout não é válido.');
      if (!dialog.open || controller.signal.aborted) return;
      try {
        sessionStorage.setItem(testing ? 'framebuilds:checkout-test' : 'framebuilds:checkout-live', data.receipt);
        sessionStorage.setItem('framebuilds:last-checkout-mode', data.mode);
      }
      catch { throw new Error('Permita o armazenamento desta aba no navegador para consultar o resultado do pagamento.'); }
      status.textContent = testing ? 'Abrindo o checkout de teste...' : 'Abrindo o Mercado Pago...';
      location.assign(url.href);
    } catch (error) {
      if (dialog.open && (timedOut || error.name !== 'AbortError')) status.textContent = timedOut ? 'O pedido demorou demais. Tente novamente; a mesma tentativa será reutilizada.' : error.message || 'Não foi possível abrir o checkout. Tente novamente.';
    } finally {
      clearTimeout(timeout);
      if (activeRequest === controller) activeRequest = null;
      render();
    }
  });
  dialog.addEventListener('close', () => activeRequest?.abort());
  window.FRAMEBUILDS_CHECKOUT = { openPurchase };
  if (testing) { showBanner(); loadConfig(); }
  else if (salesOpen) loadConfig();
  else render();
})();
