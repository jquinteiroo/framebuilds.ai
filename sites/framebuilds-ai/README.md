# framebuilds.ai

Loja publicada em https://framebuildsai.netlify.app, com pagamentos reais pelo Mercado Pago Checkout Pro e entrega de ZIPs privados após confirmação.

## Estado verificado em 26/11/2026

- Aplicação FramebuildsAI 1397095748767873; vendedor real 326355222, Brasil.
- Credenciais ativadas e guardadas como segredos no Netlify.
- Banco PostgreSQL provisionado, migração aplicada e cinco arquivos privados disponíveis.
- Dois pagamentos fictícios aprovados: saldo (191841763818) e cartão (191844456436), com retorno confirmado pela loja.
- Avaliação oficial do pagamento de cartão: nota 95, mínimo 73, homologationApprove=true. A chamada funcionou com a aplicação principal; a chamada direta à aplicação automática de teste foi recusada por propriedade OAuth.
- Preferência real criada e conferida, com vendedor, BRL, preço, referência durável e expiração corretos. Repetir a tentativa reutilizou a mesma preferência.
- Pedido real não pago permaneceu pending e seu download retornou HTTP 403. Nenhum pagamento com dinheiro real foi executado nesta validação.
- HMAC publicado validado com requisição sintética assinada (200) e sem assinatura (401). O histórico de notificações do MCP da aplicação principal não expôs entregas; não é tratado como prova de entrega de webhook do pagamento fictício.

## Ofertas

| Pacote | Preço único | Rotinas originais |
| --- | ---: | ---: |
| Conteúdo Essencial | R$ 19,90 | 15 |
| Pesquisa & Estratégia | R$ 29,90 | 10 |
| Sites & Produtividade | R$ 49,90 | 25 |
| Vídeo & Motion Studio | R$ 59,90 | 40 |
| Framebuilds Completo | R$ 97,00 | União das quatro: 90 |

São instruções originais escritas para a framebuilds.ai, sem copiar os arquivos dos plugins instalados. Cada rotina contém SKILL.md com entrada, etapas, entrega e conferência. Os cinco ZIPs incluem guia e exemplos. Ferramentas, contas e créditos externos são contratados à parte.

## Arquivos comerciais privados

As fontes ficam em .products/skills.json, .products/GUIA.md e .products/EXEMPLOS.md. Os ZIPs ficam em .products/releases. Estes arquivos são ignorados pelo Git; mantenha uma cópia privada para backup. O repositório público contém somente resumos comerciais, hashes e código da loja.

Execute python scripts/build-product-archives.py para gerar novamente os cinco ZIPs e o catálogo. A geração foi repetida com os mesmos hashes. As 90 skills passaram no quick_validate oficial e todos os ZIPs passaram na verificação de integridade.

Para uma atualização futura, configure NETLIFY_SITE_ID e NETLIFY_AUTH_TOKEN somente no ambiente local e execute node scripts/upload-products.mjs .products/releases. O script envia objetos privados com hash imutável e atualiza product-manifest.json. Nunca coloque os ZIPs em dist ou no GitHub público.

A rota temporária usada no primeiro envio foi removida depois da verificação. As variáveis FRAMEBUILDS_UPLOAD_TOKEN e FRAMEBUILDS_UPLOAD_EXPIRES eventualmente ainda existentes no Netlify não dão acesso a qualquer rota; o token também tinha prazo de expiração.

## Funcionamento dos pagamentos

O SDK oficial mercadopago@3.6.2 usa a Preferences API e init_point. A loja não recebe dados de cartão. O servidor verifica a conta real, calcula o preço e persiste pedido, versão do arquivo e tentativa antes de criar a preferência. A preferência expira em 24 horas. Falhas incertas são conciliadas por referência antes de qualquer nova criação.

O webhook payment está registrado em https://framebuildsai.netlify.app/.netlify/functions/mercadopago-webhook. O receptor valida HMAC e grava eventos antes de responder. O worker consulta Payment.get a cada dois minutos, aplica atualizações por data e repete falhas. O retorno do navegador consulta Payment.search; os parâmetros da URL nunca comprovam pagamento.

A aprovação libera o arquivo apenas para o pedido correspondente. O comprador deve salvar o link privado, válido por 30 dias desde a criação do pedido. O fragmento é removido do endereço e o download usa Authorization, sem segredo na query. Cada download reconsulta o pagamento; reembolso e contestação revogam acesso. Não há envio automático por e-mail.

## Configuração e manutenção

| Variável | Finalidade |
| --- | --- |
| MERCADOPAGO_MODE | production no ambiente público |
| MERCADOPAGO_LIVE_ENABLED | true para vendas reais |
| MERCADOPAGO_ACCESS_TOKEN | Token da aplicação real; secreto |
| MERCADOPAGO_SELLER_ID | 326355222 |
| MERCADOPAGO_ORDER_SECRET | Segredo independente, mínimo 64 caracteres |
| MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET | Assinatura completa do painel; secreta |
| NETLIFY_DB_URL | Conexão privada provisionada pelo Netlify Database |

salesOpen em packages.json também precisa ser true. O servidor só habilita checkout quando banco, segredos e todos os arquivos estão disponíveis. Para suspender novas vendas, use MERCADOPAGO_LIVE_ENABLED=false; os compradores já aprovados mantêm acesso pelos links válidos.

Para repetir testes, use um ambiente isolado com credenciais do vendedor de teste 3877354270, aplicação 1488315320590790, e comprador 3877354272. Configure MERCADOPAGO_MODE=test, MERCADOPAGO_TEST_ENABLED=true, as variáveis MERCADOPAGO_TEST_* e os segredos de teste conforme .env.example, além de APP_URL com o endereço desse ambiente. Abra /?checkout=test#pacote. Não troque o ambiente público para teste enquanto houver pedidos reais.

Pagamentos de contas de teste APP_USR podem retornar live_mode=true. O fluxo de teste verifica a tag test_user do vendedor e o collector_id em vez de usar esse campo isoladamente. O fluxo real exige um vendedor sem test_user e recibos de produção distintos; testes nunca liberam arquivos.

## Desenvolvimento e publicação

Use Node >=22.12.0 e Python 3. Execute npm ci e npm run build nesta pasta. Há 56 testes permanentes: 20 de pagamento de teste, 10 de interface, 19 de comércio com PostgreSQL/PGlite, cinco de retorno/download e dois do adaptador HTTP. O build executa todos e gera o HTML.

npm run dev executa o servidor local em http://localhost:3000. Por usar HTTP local, ele não habilita o fluxo real. python -m http.server serve apenas o frontend.

O netlify.toml na raiz define base sites/framebuilds-ai, build npm run build e publish dist. As rotas HTTP usam Functions v2 e o SDK de Blobs com leitura imediata; a conciliação usa uma Function agendada. Os SDKs de pagamento, banco e Blobs são incluídos explicitamente no empacotamento. A varredura de segredos permanece ativa; somente IDs públicos e controles de modo/booleanos estão na lista de falsos positivos.

- packages.json: preços, composição e controle de vendas.
- src/index.template.html: textos e estrutura.
- dist/catalog.js: resumos públicos das 90 rotinas.
- netlify/lib/commerce.cjs: checkout, confirmação e autorização de download.
- netlify/lib/order-repository.cjs: transações, pedidos e conciliação.
- netlify/database/migrations/: esquema PostgreSQL.
- PAYMENT-REVIEW.md: evidências e limites da validação.

npm run check:production é uma verificação de infraestrutura para executar em um contexto com acesso ao banco e Blobs. Ela não movimenta dinheiro nem substitui uma compra real aprovada. A primeira liquidação real e seu download não foram executados nesta sessão.

## Referências

- [Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/overview)
- [Aplicação Mercado Pago](https://www.mercadopago.com.br/developers/panel/app/1397095748767873)
- [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/)
- [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
