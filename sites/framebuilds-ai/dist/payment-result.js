'use strict';
(() => {
  const title = document.querySelector('#result-title');
  const description = document.querySelector('#result-description');
  const packageLine = document.querySelector('#result-package');
  const refresh = document.querySelector('#result-refresh');
  const download = document.querySelector('#result-download');
  const access = document.querySelector('#result-access');
  const testNote = document.querySelector('#result-test-note');
  const label = document.querySelector('#result-label');
  let receipt = null;
  let busy = false;
  let downloading = false;
  try {
    const restored = new URLSearchParams(location.hash.slice(1)).get('acesso');
    if (restored && restored.length <= 2048) {
      sessionStorage.setItem('framebuilds:checkout-live', restored);
      sessionStorage.setItem('framebuilds:last-checkout-mode', 'production');
      history.replaceState(null, '', location.pathname);
    }
    const mode = sessionStorage.getItem('framebuilds:last-checkout-mode');
    receipt = sessionStorage.getItem(mode === 'production' ? 'framebuilds:checkout-live' : 'framebuilds:checkout-test');
  } catch {}
  async function check() {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    download.hidden = true;
    access.hidden = true;
    if (!receipt) {
      title.textContent = 'Pedido não localizado nesta aba.';
      description.textContent = 'Abra seu link de acesso salvo ou volte aos pacotes para iniciar uma compra.';
      refresh.hidden = true;
      busy = false;
      return;
    }
    title.textContent = 'Conferindo seu pagamento.';
    description.textContent = 'Consultando o Mercado Pago...';
    try {
      const response = await fetch('/.netlify/functions/payment-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt }), signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o pagamento.');
      if (!['test', 'production'].includes(data.mode) || (data.mode === 'test' && data.deliveryEnabled !== false)) throw new Error('Resposta de pagamento inválida.');
      const testing = data.mode === 'test';
      testNote.hidden = !testing;
      label.textContent = testing ? 'AMBIENTE DE TESTES' : 'SEU PEDIDO';
      const failed = ['failed', 'refunded', 'disputed'].includes(data.status);
      title.textContent = data.status === 'approved' ? testing ? 'Pagamento de teste confirmado.' : 'Pagamento confirmado.' : failed ? 'Este pagamento não permite acesso.' : 'Aguardando confirmação.';
      description.textContent = data.status === 'approved' ? testing ? 'O pagamento foi confirmado em teste. Nenhum arquivo será liberado.' : 'Seu pacote está disponível. Baixe o arquivo e guarde o link de acesso, válido por 30 dias após iniciar a compra.' : failed ? 'O pagamento foi recusado, devolvido ou contestado. Você pode voltar aos pacotes para uma nova compra.' : 'Se você acabou de pagar, aguarde alguns instantes e consulte novamente.';
      packageLine.textContent = data.packageName + ' · ' + new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.priceCents / 100) + (data.paymentId ? ' · Pagamento ' + data.paymentId : '');
      if (!testing) {
        access.href = new URL('/pagamento.html', location.origin).href + '#acesso=' + encodeURIComponent(receipt);
        access.hidden = false;
        download.hidden = data.status !== 'approved' || data.deliveryEnabled !== true;
      }
    } catch (error) {
      title.textContent = 'Não foi possível conferir o pagamento.';
      description.textContent = error.message || 'Tente consultar novamente.';
    } finally { busy = false; refresh.disabled = false; }
  }
  download.addEventListener('click', async () => {
    if (downloading || !receipt) return;
    downloading = true;
    download.disabled = true;
    description.textContent = 'Conferindo seu acesso e preparando o arquivo...';
    try {
      const response = await fetch('/.netlify/functions/download', { method: 'POST', headers: { Authorization: 'Bearer ' + receipt }, cache: 'no-store', signal: AbortSignal.timeout(60000) });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Não foi possível baixar o pacote.');
      }
      const file = await response.blob();
      const fileName = response.headers.get('content-disposition')?.match(/filename="([a-z0-9-]+\.zip)"/)?.[1] || 'framebuilds-pacote.zip';
      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = objectUrl; link.download = fileName; link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      description.textContent = 'Download iniciado. Guarde seu link de acesso para voltar a esta página.';
    } catch (error) { description.textContent = error.message || 'Não foi possível baixar o pacote. Tente novamente.'; }
    finally { downloading = false; download.disabled = false; }
  });
  refresh.addEventListener('click', check);
  check();
})();
