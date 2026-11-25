# framebuilds.ai

Loja de apresentação em português, com quatro pacotes temáticos e um combo completo. Frontend estático e quatro Netlify Functions sem dependências externas para testar o Mercado Pago Checkout Pro via Orders API. A loja pública permanece em pré-lançamento.

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
- `netlify/lib/payments.cjs`: validação e comunicação com a Orders API.
- `test/payments.test.cjs`: casos de preço, assinatura, idempotência, ambiente e confirmação de status.
- `test/checkout-ui.test.cjs`: execução da interface com DOM e rede simulados para verificar entrada no teste, navegação, erros, timeout, cancelamento e redirecionamento. Não substitui um teste no navegador com a conta do vendedor.
- `dist/assets/creator.webp`: avatar fornecido no diretório de trabalho.

## Estado de lançamento

Os botões da página pública abrem o aviso de vendas em breve com o nome e o preço da oferta escolhida, com o link “Entrar no ambiente de testes”. O rodapé também oferece “Testar pagamento”. O parâmetro `?checkout=test` apresenta um fluxo separado, que só funciona depois da configuração das variáveis privadas do Netlify. O modo de teste é mantido no `sessionStorage` da aba, mesmo ao navegar sem o parâmetro; “Sair do teste” usa `?checkout=off` e remove essa preferência. Apenas alterar `salesOpen` não ativa uma cobrança real.

## Pagamentos de teste

As três variáveis de configuração são `MERCADOPAGO_TEST_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` e `MERCADOPAGO_TEST_ENABLED=true`. Cadastre-as no Netlify pela UI/API com acesso às Functions e faça um novo deploy. Nenhuma credencial precisa ser gravada em arquivo. O nome da variável não é uma prova de que a chave é de teste: o backend também exige que o pedido retornado seja `ORDTST...` antes de fornecer qualquer URL de checkout. Credenciais de teste e produção podem ter o mesmo prefixo `APP_USR`; copie a chave a partir do seletor **Teste** do painel.

O site canônico é obtido da variável automática `URL` do Netlify, com fallback para `https://framebuildsai.netlify.app`. As solicitações do navegador precisam ter essa mesma origem. As Functions ficam fora de `dist` e as credenciais nunca entram no frontend ou nas respostas públicas.

### Fluxo

1. O navegador envia apenas o ID do pacote e um UUID da tentativa. O backend consulta o preço em `packages.json`; valores fornecidos pelo navegador são rejeitados.
2. A referência externa utiliza apenas letras, números, hífens e underscores, com menos de 64 caracteres. `checkout` cria uma order com `processing_mode=manual` e envia o UUID em `X-Idempotency-Key`. Pedidos reais, valores divergentes, moeda diferente de BRL e URLs de checkout fora do domínio permitido são rejeitados.
3. Um comprovante de consulta, assinado pelo backend e com validade de 24 horas, fica no `sessionStorage` da aba. Não contém dados pessoais nem permite entrega de arquivos.
4. O comprador retorna a `pagamento.html`. O site envia o comprovante a `payment-status`, que consulta a order diretamente no Mercado Pago. Parâmetros como `status=approved` na URL nunca comprovam pagamento. A confirmação exige status `processed`, detalhe `accredited` e valor total pago igual ao esperado.
5. `mercadopago-webhook` valida o HMAC-SHA256 do cabeçalho `x-signature` usando a assinatura secreta da aplicação e o manifest oficial. Consulta a order, aceita repetições sem efeitos colaterais e ignora eventos de produção. Não armazena pedidos nem realiza entrega; não registra dados pessoais ou credenciais no console.

### Configurar o webhook

No Mercado Pago, selecione **Configuração de webhooks > Teste**, use `https://framebuildsai.netlify.app/.netlify/functions/mercadopago-webhook`, marque **Order (Mercado Pago)** e salve. Copie a assinatura secreta gerada para `MERCADOPAGO_WEBHOOK_SECRET` no painel do Netlify. Com as variáveis configuradas e o deploy concluído, use a simulação do painel com um ID real de uma order de teste da integração. IDs fictícios não passam na consulta à API.

`GET /.netlify/functions/payment-config` expõe apenas se o teste está configurado; `GET /.netlify/functions/mercadopago-webhook` serve para conferir se o endpoint existe. O exemplo do simulador com `data.type=point` e ID fictício `123456` é ignorado, mesmo com uma assinatura válida, e não comprova uma compra no Checkout Pro. Os demais fluxos exigem POST. A página pública não usa esses endpoints até que o modo de teste seja solicitado. Falhas do provedor retornam um código seguro `MP_HTTP_<status>`, sem repassar a resposta original, credenciais ou dados pessoais. A interface mostra o erro, limita a espera a 15 segundos e permite repetir com a mesma chave de idempotência.

### Limites desta etapa

Esta etapa prepara e testa o checkout, mas não abre vendas reais. A lista `?checkout=test` é uma opção de interface, não controle de acesso; a proteção contra cobranças reais está no backend. Não existe endpoint de download, envio de e-mail ou liberação de arquivos. Notificações validadas são reconhecidas, mas não são gravadas em banco de dados.

Antes de implementar produção, preparar os arquivos que podem ser distribuídos, armazenamento privado, um registro durável e idempotente de pedidos, recuperação de acesso do comprador, condições comerciais e suporte. A liberação deve conferir vendedor, modo de produção, moeda, referência, valor, status e pedido persistido, sem depender de redirecionamentos do navegador. Também é necessário validar a integração real com as credenciais de teste; testes automatizados com respostas simuladas não comprovam conectividade com a conta do vendedor.

Referências oficiais: [Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order?scope=prod), [URLs de retorno](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/web-integration/configure-back-urls?scope=prod), [webhooks](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications?scope=prod) e [variáveis nas Functions](https://docs.netlify.com/build/functions/environment-variables/).

Os pacotes avulsos têm seleções distintas nesta versão; o combo reúne a união, sem contar uma skill duas vezes. Foram deixadas fora nove rotinas de configuração, mascotes e gestão interna. O número de skills inclui etapas de apoio de um mesmo processo e não representa um conjunto de aplicações independentes. Os requisitos por pacote aparecem em “Ver skills e requisitos”.

O catálogo descreve as skills disponíveis no ambiente do proprietário. Este projeto não empacota os arquivos das skills, não transfere contas de ferramentas e não atribui direitos de revenda sobre materiais de terceiros. Antes de disponibilizar o pacote comercial, revisar as licenças dos materiais efetivamente incluídos e confirmar a autorização de redistribuição. Skills dependentes de plugins, sistema operacional e contas exigem ambientes compatíveis. O site explicita essas dependências nas perguntas frequentes.

O site de referência foi usado para estudar a estrutura de venda. Texto, componentes e identidade desta página foram criados para framebuilds.ai. Não foram copiados depoimentos ou resultados financeiros de terceiros.
