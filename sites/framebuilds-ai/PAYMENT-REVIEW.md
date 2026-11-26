# Mercado Pago Integration Review

Data: 26/11/2026. Checkout Pro pela Preferences API e SDK oficial mercadopago@3.6.2. Aplicação 1397095748767873; vendedor real 326355222 (MLB), confirmado via API, sem tag test_user.

## Resultado

O código de produção inclui pedidos duráveis em PostgreSQL, preferências deduplicadas, webhook com HMAC, conciliação agendada e download privado condicionado ? aprovação. A conta foi ativada no painel e as credenciais/assinatura foram guardadas como segredos no Netlify. As vendas permanecem fechadas até verificar deploy, migração, arquivos e pagamento completo.

Os testes usam PGlite para executar o esquema e as transações PostgreSQL; transportes do Mercado Pago e armazenamento são simulados. Eles não substituem um pagamento aprovado e uma notificação entregue pelo provedor.

## Verificado

- 52 testes da integração e interface aprovados; quatro testes adicionais aprovados cobrem o envio privado de arquivos.
- Os 90 diretórios de skills passaram no quick_validate oficial; os cinco ZIPs passaram em integridade e contagem.
- Conta real confirmada por /users/me, sem realizar cobrança.
- Criação de preferência e consulta de status de teste passaram na API real, ainda sem pagamento concluído.
- Segredos excluídos do Git, preços resolvidos no servidor, ambientes separados e init_point validado.
- Pedido salvo antes da preferência; lease atémico e recuperação de timeout por referência.
- HMAC verificado em tempo constante; evento persistido antes do ACK; worker com lease e repetição.
- Aprovação vinculada a vendedor, valor, BRL, referência e live_mode; atualizações antigas não sobrescrevem reembolso.
- Cada download reconsulta o pagamento; reembolso e contestação revogam acesso.
- Fontes e ZIPs pagos ignorados pelo Git; manifesto público contém somente hashes e chaves privadas.

## Pendências do ambiente

- Confirmar deploy atual, provisionamento do Netlify Database e migração.
- Enviar e verificar cinco objetos privados; manifesto isolado não comprova upload.
- Concluir pagamento com comprador de teste e conferir a notificação real.
- quality_evaluation: não executado, sem payment_id concluído.
- Homologação: get_form retornou steps vazio para produto 21. Não foi submetida.
- Manter salesOpen=false e MERCADOPAGO_LIVE_ENABLED=false até resolver essas pendências.

## Checklist oficial

A consulta quality_checklist devolveu os critérios abaixo. Esta tabela é uma comparação local do código com os critérios, não uma pontuação de homologação emitida pelo Mercado Pago. Critérios opcionais ou sem aplicação ao produto digital continuam listados para manter a revisão completa.

### Requisitos

| # | Campo | Critério oficial | Estado | Evidência e observação |
|---|---|---|---|---|
| 1 | item_quantity | Does it send the item quantity? | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 2 | item_unit_price | Does it send the unit price? | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 3 | statement_descriptor_/_soft_descriptor | Does the integration use a soft descriptor or statement descriptor? | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 4 | back_urls | Does the seller send back urls in the requestá | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 5 | webhooks_ipn | Does the integration has notifications enabled? | Parcial | URL e assinatura completa configuradas; entrega publicada ainda pendente. netlify/lib/commerce.cjs |
| 6 | external_reference | Does it send an external reference for conciliation? | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 7 | email | Does it send the payer’s email address? | Ausente | Não enviado na preferência; o checkout hospedado solicita os dados do comprador. netlify/lib/commerce.cjs |
| 8 | payer_first_name | Does it send the payer’s first name? | Ausente | Não enviado na preferência; não existe cadastro próprio do comprador. netlify/lib/commerce.cjs |
| 9 | payer_last_name | Does it send the payer’s last name? | Ausente | Não enviado na preferência. netlify/lib/commerce.cjs |
| 10 | item_category_id | Sends category id? | Ausente | Categoria comercial ainda não configurada. netlify/lib/commerce.cjs |
| 11 | item_description | Sends item description? | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 12 | item_id | Sends item id? | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 13 | item_title | Does it send the item title? | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 14 | back_end_sdk | Does the integration use any backend SDK? | Implementado | Campo enviado na criação da preferência. package.json; netlify/lib/commerce.cjs |

### Boas práticas

| # | Prática | Critério oficial | Estado | Evidência e observação |
|---|---|---|---|---|
| 1 | binary_mode | Is binary mode configurable for seller? | Ausente | Fluxo permite pagamentos pendentes; modo binário não foi solicitado. netlify/lib/commerce.cjs |
| 2 | date_of_expiration | Is date of expiration configurable for seller? | Ausente | Prazo de boleto ainda não parametrizado. netlify/lib/commerce.cjs |
| 3 | marketing_information | Uses Facebook Pixel or Google Ads services? | Ausente | Sem anúncios/rastreadores; não adicionar só para obter pontuação. netlify/lib/commerce.cjs |
| 4 | expiration | Sets expiration date? | Ausente | Recibo expira em 24h, mas a preferência ainda não recebe prazo próprio. netlify/lib/commerce.cjs |
| 5 | max_installments | Sends max installments? | Ausente | Número máximo de parcelas ainda não parametrizado. netlify/lib/commerce.cjs |
| 6 | modal | Does the integration open Checkout in modal form? | Ausente | Checkout Pro usa redirecionamento hospedado; o modal local apenas confirma a oferta. netlify/lib/commerce.cjs |
| 7 | logos | Shows Mercado Pago logo properly in Payment Methods in own website? | Ausente | Botão identifica Mercado Pago em texto; logotipo oficial ainda não incluído. netlify/lib/commerce.cjs |
| 8 | response_messages | Shows feedback to the payer for rejections or error messages from the API? | Implementado | Carregamento, falhas acionáveis e retorno aprovado/pendente/recusado implementados. dist/checkout.js; dist/payment-result.js |
| 9 | excluded_payment_methods | Exclusión de Medios de Pago | Ausente | Sem exclusões específicas solicitadas. netlify/lib/commerce.cjs |
| 10 | excluded_payment_types | Exclusión de Tipos de Medios de Pago | Ausente | Sem exclusões específicas solicitadas. netlify/lib/commerce.cjs |
| 11 | shipment_amount | Monto del envío | Ausente | Produto digital sem envio físico; frete não se aplica. netlify/lib/commerce.cjs |
| 12 | payment_get_or_search_api | Does the seller get the order or payment after notification? | Parcial | Payment.search no retorno; webhook apenas valida e reconhece sem conciliação durável. netlify/lib/commerce.cjs |
| 13 | chargebacks_api | Does the integration use chargebacks API to upload documentation in order to dispute it? | Ausente | Gestão de contestações não implementada. netlify/lib/commerce.cjs |
| 14 | cancellation_api | Does the integration cancel payments through the payments API? | Ausente | Cancelamento administrativo não implementado. netlify/lib/commerce.cjs |
| 15 | refunds_api | Does the integration use refunds API? | Ausente | Emissão administrativa de reembolsos não implementada. netlify/lib/commerce.cjs |
| 16 | settlement | Does the integration have a settlement report? | Ausente | Relatório de liberações não implementado. netlify/lib/commerce.cjs |
| 17 | release | Does the integration have a release report? | Ausente | Relatório de transações não implementado. netlify/lib/commerce.cjs |
| 18 | address | Sends payer's address? | Ausente | Endereço não coletado pela loja. netlify/lib/commerce.cjs |
| 19 | payer_identification | Does the integration send the payer’s identification type and number? | Ausente | Documento não enviado pela loja; tratado no checkout hospedado. netlify/lib/commerce.cjs |
| 20 | payer_phone | Sends payer's phone number? | Ausente | Telefone não enviado pela loja. netlify/lib/commerce.cjs |
| 21 | payer_identification_mlm | Does the integration send the payer’s identification type and number? | Ausente | Critério específico do México; projeto brasileiro. netlify/lib/commerce.cjs |
| 22 | front_end_sdk_pro | sdk .js para checkout pro | Ausente | Redirecionamento por init_point sem SDK de frontend. netlify/lib/commerce.cjs |

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

## Segurança transversal

| Verificação | Resultado no código |
| --- | --- |
| Token somente no servidor | process.env, arquivos ignorados e segredos do Netlify |
| .env ignorado; exemplo versionável | .gitignore na raiz e na pasta da aplicação |
| Assinatura do webhook | HMAC-SHA256, comparação em tempo constante e IDs conferidos |
| HTTPS de retorno/notificação | Obrigatório no fluxo de produção |
| Confirmação no servidor | Payment.search no retorno, Payment.get no worker e download |
| Idempotência | Tentativa única em PostgreSQL, lease e chave estável do SDK |
| Referência externa | UUID gerado e persistido no servidor |
| Teste separado | Vendedores e recibos independentes; tag test_user conferida |
| URL hospedada | init_point com domínio e pref_id validados |

## Implementation Report

### Verified

Aplicação criada, conta real ativada e verificada, SDK e fluxo corrigidos, armazenamento transacional/entrega implementados, testes locais aprovados e webhook registrado.

### Needs attention

Dados opcionais de comprador não são coletados pela loja; o checkout hospedado os solicita. Sem relatérios financeiros próprios, emissão administrativa de reembolso, disputa de contestação ou entrega por e-mail. Estes recursos não foram solicitados e não são apresentados como implementados.

### Blockers (must fix before production)

Verificação de infraestrutura publicada, arquivos privados e pagamento aprovado/notificação completa. Nenhuma cobrança real foi executada.

### Next steps

Concluir deploy e upload privado; validar compra de teste; revisar os controles de lançamento. Remover token temporário de provisionamento após enviar os arquivos.

### Resources used

Inspeção local, checklist oficial quality_checklist, save_webhook e get_credentials do MCP; documentação oficial Mercado Pago/Netlify; skills mp-integrate, mp-webhooks, mp-review e skill-creator.

A tabela preserva todos os critérios oficiais consultados. Não ? pontuação oficial nem certificado de homologação.
