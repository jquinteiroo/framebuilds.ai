# framebuilds.ai

Loja de pacotes originais de instruções para agentes de IA. Checkout Pro do Mercado Pago com redirecionamento hospedado, pedidos em PostgreSQL e entrega de ZIPs privados no Netlify. As vendas permanecem fechadas até validar o ambiente publicado e concluir o pagamento de teste.

## Ofertas

| Pacote | Preço único | Rotinas originais |
| --- | ---: | ---: |
| Conteúdo Essencial | R$ 19,90 | 15 |
| Pesquisa & Estratégia | R$ 29,90 | 10 |
| Sites & Produtividade | R$ 49,90 | 25 |
| Vídeo & Motion Studio | R$ 59,90 | 40 |
| Framebuilds Completo | R$ 97,00 | União das quatro: 90 |

Os arquivos foram escritos para a framebuilds.ai. Cada rotina tem SKILL.md com entrada, etapas, entrega e conferência. Todos os ZIPs incluem guia e exemplos. Ferramentas, hospedagem e créditos externos são contratados ? parte.

## Desenvolvimento

Na pasta sites/framebuilds-ai, execute npm ci e npm run build. Use Node >=22.12.0 e Python 3. O build executa os testes e gera dist/index.html e dist/packages.js. npm run dev executa o checkout local em http://localhost:3000; python -m http.server serve apenas o frontend.

- packages.json: preços, composição e salesOpen.
- src/index.template.html: conteúdo e estrutura da loja.
- dist/catalog.js: somente resumos das 90 rotinas originais.
- netlify/lib/commerce.cjs: fluxo de produção, confirmação e autorização de download.
- netlify/lib/order-repository.cjs: transações e conciliação durável.
- netlify/database/migrations/: esquema PostgreSQL aditivo.
- netlify/functions/download.mjs: entrega após confirmação real.
- netlify/functions/reconcile-payments.cjs: conciliação agendada a cada dois minutos.
- PAYMENT-REVIEW.md: revisão, evidências e pendências.

## Arquivos comerciais privados

As fontes ficam em .products/skills.json, .products/GUIA.md e .products/EXEMPLOS.md, ignorados pelo Git. Gere os cinco ZIPs com python scripts/build-product-archives.py. O script deriva o catélogo público, mas nunca publica as instruções completas. Mantenha uma cópia privada dessas fontes e dos arquivos .products/releases/*.zip; eles não podem ser recuperados do repositório público.

product-manifest.json guarda hashes, tamanhos e chaves de objetos privados. Sua presença não comprova upload: o servidor verifica os metadados dos objetos antes de habilitar checkout. Não coloque os ZIPs em dist nem no GitHub público.

Para enviar por CLI, configure NETLIFY_SITE_ID e NETLIFY_AUTH_TOKEN apenas no ambiente local e execute node scripts/upload-products.mjs .products/releases. Há também uma rota temporária provision-products protegida por token independente, prazo e allowlist dos cinco hashes: ela não lê arquivos nem altera pagamentos. Remova sua configuração depois de enviar os produtos.

## Configuração do Mercado Pago

Aplicação FramebuildsAI 1397095748767873, Checkout Pro, Brasil. Conta real de recebimento 326355222, verificada pela API. A ativação das credenciais foi concluída no painel em 26/11/2026. As credenciais ficam em .env local e nas variáveis secretas do Netlify; nunca no frontend ou no Git.

| Variável | Finalidade |
| --- | --- |
| MERCADOPAGO_MODE | test ou production; seleciona o backend inteiro |
| MERCADOPAGO_ACCESS_TOKEN | Token da aplicação real |
| MERCADOPAGO_SELLER_ID | 326355222 |
| MERCADOPAGO_ORDER_SECRET | Segredo independente, mínimo 64 caracteres |
| MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET | Assinatura completa do painel de Webhooks |
| MERCADOPAGO_LIVE_ENABLED | true somente após validação final |
| NETLIFY_DB_URL | Conexão privada, provisionada pelo Netlify Database |

O SDK oficial mercadopago@3.6.2 usa Preference.create e init_point. O servidor verifica vendedor, moeda, preço e referência; nunca recebe cartão. A preferência expira em 24 horas. Pedidos e arquivos são fixados por tentativa, com deduplicação e recuperação após timeout sem recriar a cobrança cegamente.

O webhook payment está registrado em https://framebuildsai.netlify.app/.netlify/functions/mercadopago-webhook. O receptor valida HMAC e grava o evento antes de responder. O worker consulta o pagamento real, aplica atualizações por data e repete falhas. O redirecionamento sozinho nunca libera o produto.

O comprador acessa o ZIP pelo link privado salvo na página de retorno, válido por 30 dias desde a criação do pedido. O fragmento do link ? removido do endereço e o download usa Authorization, sem segredo na query. Cada download reconsulta o pagamento e bloqueia reembolso ou contestação. Não há envio automático por e-mail; o comprador deve salvar o link.

## Teste separado

O vendedor automático de teste ? 3877354270, aplicação 1488315320590790; comprador 3877354272. Configure MERCADOPAGO_TEST_ACCESS_TOKEN, MERCADOPAGO_TEST_SELLER_ID, MERCADOPAGO_TEST_APPLICATION_ID, MERCADOPAGO_RECEIPT_SECRET e MERCADOPAGO_WEBHOOK_SECRET. Com MERCADOPAGO_MODE=test e MERCADOPAGO_TEST_ENABLED=true, abra /?checkout=test#pacote. O backend exige test_user e recusa conta real. Testes nunca autorizam download.

npm run test:connection cria uma preferência e consulta a API de teste; não executa pagamento. Essa conexão já passou, mas ainda falta concluir a compra com o comprador de teste e verificar a notificação no ambiente publicado.

## Publicação e liberação

O netlify.toml na raiz define base sites/framebuilds-ai, build npm run build, publish dist e Functions em netlify/functions. O SDK @netlify/database permite provisionamento do banco e migração no deploy; confirme o resultado no painel do Netlify antes de abrir vendas.

1. Conferir deploy, banco e migração; validar os cinco arquivos no armazenamento privado.
2. Concluir pagamento de teste aprovado e verificar notificação. Não confundir simulação de webhook com pagamento aprovado.
3. Executar npm run check:production com acesso ao banco e ao armazenamento. O comando não movimenta dinheiro nem certifica um pagamento real.
4. Configurar MERCADOPAGO_MODE=production, MERCADOPAGO_LIVE_ENABLED=true e salesOpen=true; publicar e validar o checkout completo. Abertura exige os três controles e arquivos disponíveis.
5. Depois do envio dos ZIPs, remover FRAMEBUILDS_UPLOAD_TOKEN e FRAMEBUILDS_UPLOAD_EXPIRES do ambiente.

A avaliação oficial por payment_id e a homologação não estáo certificadas. O formulário consultado pelo MCP não retornou etapas para Checkout Pro (produto 21); não foram enviadas respostas inventadas.

## Referências

- [Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/overview)
- [Painel da aplicação](https://www.mercadopago.com.br/developers/panel/app/1397095748767873)
- [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/)
- [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
