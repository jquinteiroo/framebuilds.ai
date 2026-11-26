# Mercado Pago Integration Review

**Escopo:** Checkout Pro, segurança e checklist oficial.
**API detectada:** Preferences API, Payment.search e consulta GET /users/me.
**Aplicação:** FramebuildsAI 1397095748767873, Brasil (MLB).
**Conta usada em testes:** vendedor automático 3877354270; aplicação 1488315320590790.
**Arquivos analisados:** netlify/lib/payments.cjs, netlify/functions/*.cjs, dist/checkout.js, dist/payment-result.js, src/index.template.html, .gitignore, package.json e testes.
**Data:** 26/11/2026.

## Críticos

- Ativação de credenciais reais e homologação ainda pendentes; cobranças reais permanecem desabilitadas.
- Variáveis novas ainda precisam ser importadas no Netlify; o arquivo privado de importação está preparado localmente.
- O MCP registrou o webhook, mas retorna somente parte da assinatura. Falta configurar a chave completa e verificar uma entrega real.
- Não há registro durável de pedidos, fila de conciliação ou entrega de arquivos. Não abrir vendas sem implementar essas etapas.

## Avisos

- Criar uma preferência e consultar status pendente não comprova um pagamento aprovado.
- Comprovantes da implementação anterior são incompatíveis; iniciar uma nova tentativa de teste.
- A chave de idempotência é enviada ao SDK; isso não substitui deduplicação durável de pedidos em produção.
- O receptor reconhece notificações assinadas imediatamente. Nenhuma tarefa é executada após responder uma Function clássica; conciliação durável fica pendente.

## Verificado

- SDK oficial mercadopago@3.6.2 instalado a partir do registro oficial com integridade SHA-512 verificada.
- 18 testes de backend e 8 de interface aprovados.
- Validadores de servidor Checkout Pro e botão de checkout aprovados.
- API real confirmou conta de teste, criação de preferência e consulta de status pendente. Nenhum pagamento foi concluído.
- O backend rejeita um vendedor real antes de criar a preferência.
- Preços, moeda, vendedor e referência são conferidos no servidor.

## Checklist oficial

A consulta quality_checklist devolveu os critérios abaixo. Esta tabela é uma comparação local do código com os critérios, não uma pontuação de homologação emitida pelo Mercado Pago. Critérios opcionais ou sem aplicação ao produto digital continuam listados para manter a revisão completa.

### Requisitos

| # | Campo | Critério oficial | Estado | Evidência e observação |
|---|---|---|---|---|
| 1 | item_quantity | Does it send the item quantity? | Implementado | Campo enviado na criação da preferência. netlify/lib/payments.cjs |
| 2 | item_unit_price | Does it send the unit price? | Implementado | Campo enviado na criação da preferência. netlify/lib/payments.cjs |
| 3 | statement_descriptor_/_soft_descriptor | Does the integration use a soft descriptor or statement descriptor? | Implementado | Campo enviado na criação da preferência. netlify/lib/payments.cjs |
| 4 | back_urls | Does the seller send back urls in the request? | Implementado | Campo enviado na criação da preferência. netlify/lib/payments.cjs |
| 5 | webhooks_ipn | Does the integration has notifications enabled? | Parcial | URL registrada via MCP; assinatura completa e entrega real ainda pendentes. netlify/lib/payments.cjs |
| 6 | external_reference | Does it send an external reference for conciliation? | Implementado | Campo enviado na criação da preferência. netlify/lib/payments.cjs |
| 7 | email | Does it send the payer’s email address? | Ausente | Não enviado na preferência; o checkout hospedado solicita os dados do comprador. netlify/lib/payments.cjs |
| 8 | payer_first_name | Does it send the payer’s first name? | Ausente | Não enviado na preferência; não existe cadastro próprio do comprador. netlify/lib/payments.cjs |
| 9 | payer_last_name | Does it send the payer’s last name? | Ausente | Não enviado na preferência. netlify/lib/payments.cjs |
| 10 | item_category_id | Sends category id? | Ausente | Categoria comercial ainda não configurada. netlify/lib/payments.cjs |
| 11 | item_description | Sends item description? | Implementado | Campo enviado na criação da preferência. netlify/lib/payments.cjs |
| 12 | item_id | Sends item id? | Implementado | Campo enviado na criação da preferência. netlify/lib/payments.cjs |
| 13 | item_title | Does it send the item title? | Implementado | Campo enviado na criação da preferência. netlify/lib/payments.cjs |
| 14 | back_end_sdk | Does the integration use any backend SDK? | Implementado | Campo enviado na criação da preferência. package.json; netlify/lib/payments.cjs |

### Boas práticas

| # | Prática | Critério oficial | Estado | Evidência e observação |
|---|---|---|---|---|
| 1 | binary_mode | Is binary mode configurable for seller? | Ausente | Fluxo permite pagamentos pendentes; modo binário não foi solicitado. netlify/lib/payments.cjs |
| 2 | date_of_expiration | Is date of expiration configurable for seller? | Ausente | Prazo de boleto ainda não parametrizado. netlify/lib/payments.cjs |
| 3 | marketing_information | Uses Facebook Pixel or Google Ads services? | Ausente | Sem anúncios/rastreadores; não adicionar só para obter pontuação. netlify/lib/payments.cjs |
| 4 | expiration | Sets expiration date? | Ausente | Recibo expira em 24h, mas a preferência ainda não recebe prazo próprio. netlify/lib/payments.cjs |
| 5 | max_installments | Sends max installments? | Ausente | Número máximo de parcelas ainda não parametrizado. netlify/lib/payments.cjs |
| 6 | modal | Does the integration open Checkout in modal form? | Ausente | Checkout Pro usa redirecionamento hospedado; o modal local apenas confirma a oferta. netlify/lib/payments.cjs |
| 7 | logos | Shows Mercado Pago logo properly in Payment Methods in own website? | Ausente | Botão identifica Mercado Pago em texto; logotipo oficial ainda não incluído. netlify/lib/payments.cjs |
| 8 | response_messages | Shows feedback to the payer for rejections or error messages from the API? | Implementado | Carregamento, falhas acionáveis e retorno aprovado/pendente/recusado implementados. dist/checkout.js; dist/payment-result.js |
| 9 | excluded_payment_methods | Exclusión de Medios de Pago | Ausente | Sem exclusões específicas solicitadas. netlify/lib/payments.cjs |
| 10 | excluded_payment_types | Exclusión de Tipos de Medios de Pago | Ausente | Sem exclusões específicas solicitadas. netlify/lib/payments.cjs |
| 11 | shipment_amount | Monto del envío | Ausente | Produto digital sem envio físico; frete não se aplica. netlify/lib/payments.cjs |
| 12 | payment_get_or_search_api | Does the seller get the order or payment after notification? | Parcial | Payment.search no retorno; webhook apenas valida e reconhece sem conciliação durável. netlify/lib/payments.cjs |
| 13 | chargebacks_api | Does the integration use chargebacks API to upload documentation in order to dispute it? | Ausente | Gestão de contestações não implementada. netlify/lib/payments.cjs |
| 14 | cancellation_api | Does the integration cancel payments through the payments API? | Ausente | Cancelamento administrativo não implementado. netlify/lib/payments.cjs |
| 15 | refunds_api | Does the integration use refunds API? | Ausente | Emissão administrativa de reembolsos não implementada. netlify/lib/payments.cjs |
| 16 | settlement | Does the integration have a settlement report? | Ausente | Relatório de liberações não implementado. netlify/lib/payments.cjs |
| 17 | release | Does the integration have a release report? | Ausente | Relatório de transações não implementado. netlify/lib/payments.cjs |
| 18 | address | Sends payer's address? | Ausente | Endereço não coletado pela loja. netlify/lib/payments.cjs |
| 19 | payer_identification | Does the integration send the payer’s identification type and number? | Ausente | Documento não enviado pela loja; tratado no checkout hospedado. netlify/lib/payments.cjs |
| 20 | payer_phone | Sends payer's phone number? | Ausente | Telefone não enviado pela loja. netlify/lib/payments.cjs |
| 21 | payer_identification_mlm | Does the integration send the payer’s identification type and number? | Ausente | Critério específico do México; projeto brasileiro. netlify/lib/payments.cjs |
| 22 | front_end_sdk_pro | sdk .js para checkout pro | Ausente | Redirecionamento por init_point sem SDK de frontend. netlify/lib/payments.cjs |

## Segurança transversal

| # | Verificação | Estado | Evidência |
|---|---|---|---|
| 1 | Token somente no servidor | Passou | process.env em payments.cjs; valores somente no .env privado |
| 2 | .env ignorado e .env.example versionável | Passou | .gitignore |
| 3 | HMAC-SHA256 em tempo constante | Passou no código e testes | webhook, equalHex e timingSafeEqual em payments.cjs; falta teste de entrega |
| 4 | HTTPS público para retorno automático e notificações | Passou | publicAppUrl; localhost omite auto_return e notification_url |
| 5 | Status relido no servidor | Passou | Preference.get e Payment.search; parâmetros do redirect ignorados |
| 6 | Chave de idempotência estável por tentativa | Passou no envio | requestOptions.idempotencyKey e teste com SDK real |
| 7 | Referência externa | Passou | external_reference calculada no servidor |
| 8 | Credenciais de teste separadas | Passou no código local | .env privado e checagem de vendedor test_user via API |
| 9 | URL de checkout correta | Passou | init_point; domínio e pref_id validados |

## Implementation Report

### Verified

- [x] Aplicação criada e credenciais de teste importadas para arquivo privado.
- [x] Checkout Pro corrigido para Preferences API e SDK oficial.
- [x] Botão existente ligado à criação da preferência e ao redirecionamento.
- [x] 26 testes automatizados, build e dois validadores aprovados.
- [x] Conexão real, preferência de teste e consulta de status verificadas.
- [x] Webhook cadastrado via MCP com tópico payment.

### Needs attention

- [ ] Importar as variáveis privadas de teste no Netlify.
- [ ] Obter a assinatura completa no painel e configurar MERCADOPAGO_WEBHOOK_SECRET.
- [ ] Concluir uma compra de teste com o comprador automático e conferir notificações.
- [ ] quality_evaluation: não executado, pois ainda não há payment_id de compra concluída.
- [ ] Formulário de homologação não submetido.

### Blockers (must fix before production)

- [ ] Credenciais reais ainda não ativadas.
- [ ] Registro durável de pedidos, conciliação e entrega idempotente não implementados.
- [ ] Pagamento completo e notificações reais ainda não validados.

### Next steps

1. Configurar variáveis no Netlify e a assinatura completa do webhook.
2. Concluir o pagamento de teste e avaliar o payment_id pela aplicação de teste 1488315320590790.
3. Implementar persistência/entrega, concluir homologação e executar mp-review novamente antes da produção.

### Resources used

- Inspeção local e checklist transversal de segurança.
- MCP quality_checklist e save_webhook, consultados em 26/11/2026.
- API real via SDK oficial para criação de preferência e busca de pagamentos.
- Skills mp-integrate, mp-webhooks e mp-review v1.0.0.

**Resultado local:** 9/14 requisitos implementados, 1/22 boas práticas implementadas, 9/9 verificações de segurança no código. Critérios opcionais e não aplicáveis estão discriminados acima. **Veredito:** integração de teste implementada; produção bloqueada. Nenhuma pontuação oficial de pagamento foi obtida.
