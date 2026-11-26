# framebuilds.ai

Loja publicada em https://framebuildsai.netlify.app, com 90 rotinas originais em quatro pacotes e um combo, Mercado Pago Checkout Pro e entrega de arquivos privados.

Pagamentos reais estão habilitados. Foram concluídos dois pagamentos fictícios e a avaliação oficial do cartão retornou nota 95 e homologação aprovada. A criação de uma preferência real, a reutilização da tentativa e o bloqueio de download de pedido não pago foram verificados. Nenhum pagamento com dinheiro real foi executado.

Consulte o [guia de desenvolvimento, produtos e manutenção](sites/framebuilds-ai/README.md) e a [revisão de pagamentos](sites/framebuilds-ai/PAYMENT-REVIEW.md).

O deploy usa netlify.toml: base sites/framebuilds-ai, build npm run build e diretório público dist. As fontes e os ZIPs pagos ficam em .products, ignorados pelo Git. Apenas resumos e hashes entram no repositório público.
