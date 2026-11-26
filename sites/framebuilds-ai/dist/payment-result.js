'use strict';
(() => {
  const title = document.querySelector('#result-title');
  const description = document.querySelector('#result-description');
  const packageLine = document.querySelector('#result-package');
  const refresh = document.querySelector('#result-refresh');
  let busy = false;
  // Return query parameters, including status=approved, are never proof of payment.
  async function check() {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    let receipt;
    try { receipt = sessionStorage.getItem('framebuilds:checkout-test'); } catch {}
    if (!receipt) {
      title.textContent = 'Teste não localizado nesta aba.';
      description.textContent = 'Volte aos pacotes e inicie uma nova tentativa de teste.';
      refresh.hidden = true;
      busy = false;
      return;
    }
    title.textContent = 'Conferindo seu teste.';
    description.textContent = 'Consultando o Mercado Pago...';
    try {
      const response = await fetch('/.netlify/functions/payment-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt }), signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o teste.');
      if (data.mode !== 'test' || data.deliveryEnabled !== false) throw new Error('Resposta de teste inválida.');
      title.textContent = data.status === 'approved' ? 'Pagamento de teste confirmado.' : data.status === 'failed' ? 'O teste não foi aprovado.' : 'O teste aguarda confirmação.';
      description.textContent = data.status === 'approved' ? 'O Mercado Pago confirmou este pagamento no ambiente de testes.' : data.status === 'failed' ? 'Você pode voltar aos pacotes e iniciar uma nova tentativa.' : 'O pagamento ainda está em processamento ou pendente. Consulte novamente em alguns instantes.';
      packageLine.textContent = `${data.packageName} · ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.priceCents / 100)}${data.paymentId ? ` · Pagamento ${data.paymentId}` : ''}`;
    } catch (error) {
      title.textContent = 'Não foi possível confirmar o teste.';
      description.textContent = error.message || 'Tente consultar novamente.';
    } finally {
      busy = false;
      refresh.disabled = false;
    }
  }
  refresh.addEventListener('click', check);
  check();
})();
