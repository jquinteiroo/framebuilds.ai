# Mercado Pago Integration Review

Data: 26/11/2026. Checkout Pro pela Preferences API e mercadopago@3.6.2. Aplicação 1397095748767873; vendedor real 326355222 (MLB), confirmado via API e sem test_user.

## Resultado

Integração publicada em produção com pedidos PostgreSQL, preferências deduplicadas, webhook com HMAC, conciliação agendada e entrega de ZIPs privados. Configuração publicada: enabled=true, mode=production, livePaymentsEnabled=true, deliveryEnabled=true.

A avaliação oficial do pagamento fictício de cartão 191844456436 retornou score=95, minScore=73 e homologationApprove=true, sem critérios obrigatórios incompletos. O pagamento fictício com saldo 191841763818 também foi aprovado. A interface confirmou os dois retornos em modo de teste, sem liberar arquivos.

Foi criada e consultada uma preferência de produção de R$ 19,90, com collector_id=326355222, BRL, referência durável, notification_url e expiração corretos. Repetir o mesmo attemptId retornou a mesma preferência. O pedido não pago permaneceu pending e seu download retornou 403. Nenhum pagamento com dinheiro real foi executado.

## Evidências

- 56 testes permanentes aprovados: 20 de pagamentos de teste, 10 de interface, 19 de comércio com PostgreSQL/PGlite, cinco de resultado/download e dois de adaptação HTTP.
- 90 skills originais passaram no quick_validate oficial. Cinco ZIPs íntegros, geração reproduzível e upload privado confirmado.
- Netlify Database provisionado e migração aplicada; pedidos e eventos usam transações, locks e leases.
- O pedido é salvo antes da preferência; falhas incertas são recuperadas por referência.
- HMAC sintético publicado retornou 200 com assinatura válida e 401 sem assinatura. Isso comprova autenticação/rede, sem ser apresentado como entrega do provedor.
- Aprovação confere vendedor, valor, BRL e referência; atualizações antigas não sobrescrevem reembolso.
- Fluxo real recusa vendedor test_user. Contas APP_USR de teste podem informar live_mode=true; o teste usa a tag verificada e o collector_id, com recibos distintos e entrega sempre desativada.
- Cada download reconsulta o pagamento; reembolso e contestação revogam acesso.
- Segredos, fontes pagas e ZIPs fora do Git público. Rota temporária de provisionamento removida após o envio.

## Limites da validação

- O primeiro pagamento com dinheiro real, sua liquidação e o download decorrente ainda não foram executados.
- O histórico de notificações do MCP da aplicação principal não mostrou eventos. A consulta direta à aplicação automática de teste foi recusada por propriedade OAuth. Não há afirmação de entrega de webhook do pagamento fictício com base nesse histórico.
- A avaliação oficial funcionou pela aplicação principal, que resolveu o pagamento automático de teste. A chamada direta à aplicação do vendedor de teste também foi recusada por propriedade OAuth.
- O get_form anterior retornou steps vazio para produto 21; nenhum formulário vazio foi submetido. A aprovação relatada acima vem do campo homologationApprove da avaliação oficial do pagamento de cartão.

## Checklist oficial

A consulta quality_checklist devolveu os critérios abaixo. Esta tabela é uma comparação local do código com os critérios, não uma pontuação de homologação emitida pelo Mercado Pago. Critérios opcionais ou sem aplicação ao produto digital continuam listados para manter a revisão completa.

### Requisitos

| # | Campo | Critério oficial | Estado | Evidência e observação |
|---|---|---|---|---|
| 1 | item_quantity | Does it send the item quantity? | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 2 | item_unit_price | Does it send the unit price? | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 3 | statement_descriptor_/_soft_descriptor | Does the integration use a soft descriptor or statement descriptor? | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 4 | back_urls | Does the seller send back urls in the requestá | Implementado | Campo enviado na criação da preferência. netlify/lib/commerce.cjs |
| 5 | webhooks_ipn | Does the integration has notifications enabled? | Parcial | URL e assinatura configuradas; HMAC publicado testado. A avaliação oficial aprovou o campo notification_url; o histórico de entregas do MCP não mostrou eventos. netlify/lib/commerce.cjs |
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

| Verificação | Evidência |
| --- | --- |
| Token no servidor | process.env, .env ignorado e segredos Netlify |
| Arquivos privados ignorados | .gitignore na raiz e na aplicação; ZIPs em .products |
| Assinatura | HMAC-SHA256 em tempo constante e IDs conferidos |
| HTTPS | Obrigatório em produção |
| Confirmação no servidor | Payment.search no retorno; Payment.get no worker/download |
| Idempotência | Tentativa única em PostgreSQL, lease e chave estável do SDK |
| Referência externa | UUID gerado e persistido no servidor |
| Separação dos ambientes | Vendedor/tag, recibos e chaves de armazenamento independentes |
| URL hospedada | init_point com domínio e pref_id validados |

## Implementation Report

### Verified

Aplicação criada, credenciais reais ativadas, conta verificada, banco e arquivos privados configurados, dois pagamentos fictícios aprovados, avaliação oficial 95/aprovada, preferência de produção e bloqueio de download não pago verificados.

### Needs attention

Acompanhar a primeira compra real e as notificações no painel. Não há envio de link por e-mail, relatórios financeiros próprios, emissão administrativa de reembolsos ou disputa de contestação pela loja. O comprador salva o link privado de acesso por 30 dias.

### Blockers

Nenhum bloqueio de configuração foi identificado na verificação publicada. Os limites de validação real estão discriminados acima.

### Next steps

Monitorar a primeira compra real e manter backup privado de .products. Para suspender novas vendas, usar MERCADOPAGO_LIVE_ENABLED=false; não trocar o ambiente público para teste enquanto houver pedidos reais.

### Resources used

SDK e APIs oficiais Mercado Pago; MCP get_credentials, save_webhook, create_test_user (retornou o comprador automático existente), quality_checklist, quality_evaluation e notifications_history; documentação oficial Netlify; skills mp-integrate, mp-webhooks, mp-review, mp-test-setup e skill-creator.

A tabela acima compara o código local com todos os critérios consultados. A pontuação 95 é o resultado oficial do pagamento de cartão; não é uma pontuação calculada a partir da tabela local.
