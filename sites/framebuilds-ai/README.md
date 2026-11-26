# framebuilds.ai

Loja de apresentação em português, com quatro pacotes temáticos e um combo completo. Frontend estático e quatro Netlify Functions com o SDK oficial mercadopago@3.6.2 para testar Checkout Pro pela Preferences API. A loja pública permanece em pré-lançamento.

| Oferta | Preço único | Composição |
| --- | ---: | ---: |
| Conteúdo Essencial | R$ 19,90 | 15 skills e rotinas |
| Pesquisa & Estratégia | R$ 29,90 | 10 skills e rotinas |
| Sites & Produtividade | R$ 49,90 | 25 skills e rotinas |
| Vídeo & Motion Studio | R$ 59,90 | 40 skills e rotinas |
| Framebuilds Completo | R$ 97,00 | União dos quatro: 90 skills e rotinas |

São preços iniciais de oferta, ainda sem vendas abertas. Os avulsos somam R$ 159,60; o combo economiza R$ 62,60 em relação à compra dos quatro. Não há promessa de suporte ilimitado, atualizações perpétuas ou assinatura de ferramentas.

## Prévia local

Execute `python -m http.server 4173 --bind 127.0.0.1 --directory dist` nesta pasta e abra http://127.0.0.1:4173.

O servidor estático permite conferir a apresentação, mas não executa Functions. Para validar a lógica de pagamento sem rede ou credenciais reais, execute `node test/payments.test.cjs` e `node test/checkout-ui.test.cjs`. O Netlify usa Node 22 e executa os testes no build antes de gerar o HTML.

## Edição

- `packages.json`: fonte única de nomes, preços em centavos, benefícios, requisitos e composição dos pacotes.
- `src/index.template.html`: estrutura e conteúdo da página. Depois de editar, execute `python scripts/build_site.py`.
- `scripts/build_site.py`: valida o inventário, resolve a composição do combo e gera `dist/index.html` e `dist/packages.js`.
- `dist/index.html` e `dist/packages.js`: arquivos gerados; não edite preços diretamente neles.
- `dist/styles.css`: identidade visual e layouts responsivos.
- `dist/packages.css`: componentes dos pacotes, combo e detalhes.
- `dist/catalog.js`: inventário editorial original de 99 skills identificadas na sessão. A loja exibe apenas as 90 selecionadas na composição dos pacotes.
- `dist/app.js`: busca, filtros por categoria e pacote, menu celular, exemplos, detalhes e modais.
- `dist/checkout.js`: entrada e persistência do modo de teste, criação do checkout e erros visíveis com timeout e nova tentativa.
- `dist/checkout.css`, `dist/pagamento.html` e `dist/payment-result.js`: interface e resultado do checkout de teste.
- `netlify/functions/`: criação de checkout, configuração pública, consulta de status e webhook.
- `netlify/lib/payments.cjs`: validação, SDK oficial e comunicação com a Preferences API.
- `test/payments.test.cjs`: casos de preço, assinatura, idempotência, ambiente e confirmação de status.
- `test/checkout-ui.test.cjs`: execução da interface com DOM e rede simulados para verificar entrada no teste, navegação, erros, timeout, cancelamento e redirecionamento. Não substitui um teste no navegador com a conta do vendedor.
- `dist/assets/creator.webp`: avatar fornecido no diretório de trabalho.

## Estado de lançamento

Os botões da página pública abrem o aviso de vendas em breve com o nome e o preço da oferta escolhida, com o link “Entrar no ambiente de testes”. O rodapé também oferece “Testar pagamento”. O parâmetro `?checkout=test` apresenta um fluxo separado, que só funciona depois da configuração das variáveis privadas do Netlify. O modo de teste é mantido no `sessionStorage` da aba, mesmo ao navegar sem o parâmetro; “Sair do teste” usa `?checkout=off` e remove essa preferência. Apenas alterar `salesOpen` não ativa uma cobrança real.

## Pagamentos de teste

### 1. Instalação

Execute npm ci nesta pasta. O SDK oficial mercadopago está fixado em 3.6.2, versão estável consultada no registro oficial em 26/11/2026. O Netlify executa npm run build, que roda 26 testes e gera o site. Node 22 ou superior.

### 2. Credenciais

O arquivo privado .env foi preenchido com as credenciais da conta automática de teste, vendedor 3877354270, aplicação 1488315320590790. A aplicação principal FramebuildsAI é 1397095748767873. Consulte .env.example para os nomes das variáveis. Nunca commite .env ou .netlify. A public key foi guardada localmente, mas o redirecionamento hospedado não precisa expô-la no navegador.

Para Netlify, importe o conteúdo do arquivo local .netlify/netlify-test.env como valores secretos. A assinatura completa do webhook precisa ser copiada do painel para MERCADOPAGO_WEBHOOK_SECRET; o MCP retorna somente um prefixo mascarado. O segredo MERCADOPAGO_RECEIPT_SECRET, gerado localmente, é diferente da assinatura do webhook. A ausência desta última não impede criar uma preferência, mas impede validar notificações e impede produção.

Para executar o checkout localmente, use npm run dev e abra http://localhost:3000/?checkout=test#pacote. Esse servidor executa as mesmas funções do Netlify; python -m http.server mostra somente a apresentação. No localhost, auto_return e notification_url são omitidos.

### 3. Servidor

netlify/lib/payments.cjs usa MercadoPagoConfig, Preference.create, Preference.get e Payment.search. O navegador envia somente packageId e attemptId. O servidor resolve o preço em packages.json, valida o vendedor por GET /users/me e exige a tag test_user, o ID configurado e o país MLB antes de criar a preferência. Assim, um token real não pode abrir o checkout deste fluxo.

A criação usa a Preferences API (/checkout/preferences), external_reference e a mesma chave de tentativa em requestOptions.idempotencyKey. Ela nunca cria um pagamento diretamente nem recebe dados de cartão. A chave de idempotência enviada não substitui persistência e deduplicação durável em produção.

### 4. Cliente

O botão #checkout-action, marcado com data-mp-checkout-cta=checkout-pro, mantém o preço visível no modal e redireciona ao init_point. O navegador exibe carregamento, erros acionáveis e permite repetir a tentativa. O comprovante assinado fica no sessionStorage; recibos da implementação anterior precisam ser substituídos iniciando um novo teste.

O retorno a pagamento.html consulta o servidor. A aprovação exige status approved, detalhe accredited, live_mode=false, vendedor, moeda, referência e valor correspondentes, sem reembolso. A interface mostra o ID do pagamento quando disponível. Parâmetros da URL nunca são prova de aprovação.

Cartões de teste do Brasil: Visa 4235 6477 2802 5682 ou Mastercard 5031 4332 1540 6351; validade 11/30; CVV 123; titular APRO para aprovação ou FUND para recusa; CPF 12345678909. Use somente dentro do fluxo de teste e com o comprador de teste, nunca com a conta do vendedor.

### 5. Webhook

A skill mp-webhooks orientou o receptor em netlify/functions/mercadopago-webhook.cjs. O tópico correto é payment (Pagamentos). A configuração de teste da aplicação principal foi salva com a URL https://framebuildsai.netlify.app/.netlify/functions/mercadopago-webhook.

O receptor valida HMAC-SHA256 usando data.id da query, x-request-id e ts; compara em tempo constante e confere se o ID do corpo coincide. Eventos de produção são ignorados. Responde 200 imediatamente para notificações válidas, sem trabalho assíncrono que possa ser encerrado pelo runtime do Netlify. Nesta fase não há processamento durável nem liberação de arquivos; a consulta no retorno é independente. Antes de vendas reais, adicionar fila durável, conciliação, registro de pedidos e entrega idempotente.

### 6. Testes

npm test executa 18 testes de backend e 8 de interface, incluindo o SDK real com transporte simulado. npm run test:connection cria uma preferência com as credenciais do .env e consulta seu status na API real; salva dados técnicos somente em .netlify/connection-test.json.

A conexão real, criação de preferência e consulta foram aprovadas; o resultado permanece pending, porque nenhum pagamento foi concluído. Isso não comprova um pagamento aprovado nem a entrega do webhook. Use o comprador automático 3877354272 no checkout e conclua o teste com os cartões acima. A skill mp-test-setup serve para criar ou financiar outro comprador, se necessário; as contas automáticas existentes não foram duplicadas.

### 7. Documentação

- [Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/overview)
- [API de preferências](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/overview)
- [Configuração da aplicação](https://www.mercadopago.com.br/developers/panel/app/1397095748767873)
- [Variáveis das Functions](https://docs.netlify.com/build/functions/environment-variables/)

### 8. Cuidados

Use init_point. Auto_return só é habilitado para HTTPS público. Prefixos de chave não comprovam o tipo da conta: o teste verifica o vendedor via API. O valor da compra é calculado no servidor. Não confie no status do redirecionamento ou na assinatura de um webhook como prova isolada de pagamento.

### 9. Próximas etapas

1. Concluir a configuração da assinatura e verificar a entrega do webhook (mp-webhooks).
2. Concluir uma compra com o comprador de teste (mp-test-setup, se precisar preparar outro).
3. Executar a avaliação por payment_id e homologação com mp-review. A revisão está em PAYMENT-REVIEW.md; produção ainda não está liberada.

Os pacotes avulsos têm seleções distintas nesta versão; o combo reúne a união, sem contar uma skill duas vezes. Foram deixadas fora nove rotinas de configuração, mascotes e gestão interna. O número de skills inclui etapas de apoio de um mesmo processo e não representa um conjunto de aplicações independentes. Os requisitos por pacote aparecem em “Ver skills e requisitos”.

O catálogo descreve as skills disponíveis no ambiente do proprietário. Este projeto não empacota os arquivos das skills, não transfere contas de ferramentas e não atribui direitos de revenda sobre materiais de terceiros. Antes de disponibilizar o pacote comercial, revisar as licenças dos materiais efetivamente incluídos e confirmar a autorização de redistribuição. Skills dependentes de plugins, sistema operacional e contas exigem ambientes compatíveis. O site explicita essas dependências nas perguntas frequentes.

O site de referência foi usado para estudar a estrutura de venda. Texto, componentes e identidade desta página foram criados para framebuilds.ai. Não foram copiados depoimentos ou resultados financeiros de terceiros.
