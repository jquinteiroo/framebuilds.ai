# framebuilds.ai

Site em português para apresentar quatro pacotes de skills de IA e um combo completo. HTML, CSS e JavaScript, com catálogo pesquisável, filtros por pacote, requisitos e exemplos. A loja pública permanece em pré-lançamento; um fluxo separado permite testar o Checkout Pro do Mercado Pago, sem vendas reais ou entrega de arquivos.

## Publicar no Netlify

Importe o repositório `jquinteiroo/framebuilds.ai` pelo GitHub e escolha a branch `main`. O arquivo [`netlify.toml`](netlify.toml) na raiz configura o deploy:

| Campo | Valor |
| --- | --- |
| Base directory | `sites/framebuilds-ai` |
| Build command | `npm run build` |
| Publish directory | `dist`, relativa à base |
| Python | `3.12` |
| Node.js | `22` |
| Functions directory | `netlify/functions`, relativa à base |

O Netlify instala o SDK oficial `mercadopago@3.6.2` a partir do lockfile. Sem configuração de credenciais, os endpoints de pagamento permanecem desativados. Após conectar o repositório, novos commits em `main` podem ser publicados automaticamente pela integração Git do Netlify.

## Configurar o pagamento de teste

A aplicação **FramebuildsAI** (ID 1397095748767873) usa Checkout Pro no Brasil. As credenciais de teste pertencem ao vendedor automático 3877354270, aplicação 1488315320590790; o comprador automático é 3877354272. Credenciais reais da aplicação principal ainda não estão ativadas.

As credenciais importadas ficam somente em sites/framebuilds-ai/.env, ignorado pelo Git. No Netlify, abra **Project configuration > Environment variables** e importe as seguintes variáveis como secretas, disponíveis para Functions:

| Variável | Valor |
| --- | --- |
| MERCADOPAGO_TEST_ACCESS_TOKEN | Access Token do vendedor de teste automático |
| MERCADOPAGO_TEST_SELLER_ID | 3877354270 |
| MERCADOPAGO_TEST_APPLICATION_ID | 1488315320590790 |
| MERCADOPAGO_RECEIPT_SECRET | Segredo aleatório exclusivo, já gerado no arquivo local |
| MERCADOPAGO_TEST_ENABLED | true |
| MERCADOPAGO_WEBHOOK_SECRET | Assinatura completa do painel de Webhooks, contexto Teste |

A importação pode ser feita pelo conteúdo do arquivo privado sites/framebuilds-ai/.netlify/netlify-test.env. Ele contém as variáveis necessárias ao checkout; a assinatura do webhook deve ser preenchida separadamente no Netlify e no .env. Nunca envie chaves no chat nem as inclua em commits. Não importe a variável automática URL do Netlify.

O webhook da aplicação foi cadastrado em https://framebuildsai.netlify.app/.netlify/functions/mercadopago-webhook com o tópico **payment (Pagamentos)**. O MCP revela somente os primeiros caracteres da assinatura, portanto a chave completa precisa ser obtida no painel. A entrega de uma notificação real ainda precisa ser testada.

Após configurar e publicar, abra https://framebuildsai.netlify.app/?checkout=test#pacote e selecione um pacote. A loja continua em pré-lançamento. O servidor confirma o ID e a identificação de conta de teste do vendedor antes de criar uma preferência; nenhuma entrega de arquivos está habilitada.

Foram aprovados 26 testes automatizados e um teste real de criação de preferência/consulta ao Mercado Pago, ainda sem concluir o pagamento. Consulte os [detalhes da integração](sites/framebuilds-ai/README.md#pagamentos-de-teste) e a [revisão](sites/framebuilds-ai/PAYMENT-REVIEW.md).

## Alterações

- **Preços, nomes e composição:** [`sites/framebuilds-ai/packages.json`](sites/framebuilds-ai/packages.json).
- **Textos e estrutura:** [`sites/framebuilds-ai/src/index.template.html`](sites/framebuilds-ai/src/index.template.html).
- **Estilos:** `sites/framebuilds-ai/dist/styles.css` e `packages.css`.
- **Interações:** `sites/framebuilds-ai/dist/app.js`.
- **Catálogo:** `sites/framebuilds-ai/dist/catalog.js`.

O Netlify executa o build a cada deploy. Para gerar os arquivos localmente, execute na raiz do repositório:

```sh
python sites/framebuilds-ai/scripts/build_site.py
```

Para conferir o site localmente:

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory sites/framebuilds-ai/dist
```

Abra `http://127.0.0.1:4173`. Os arquivos publicados ficam em `sites/framebuilds-ai/dist`; apenas esse diretório é servido ao visitante.

## Ofertas

| Pacote | Preço único | Skills e rotinas |
| --- | ---: | ---: |
| Conteúdo Essencial | R$ 19,90 | 15 |
| Pesquisa & Estratégia | R$ 29,90 | 10 |
| Sites & Produtividade | R$ 49,90 | 25 |
| Vídeo & Motion Studio | R$ 59,90 | 40 |
| Framebuilds Completo | R$ 97,00 | 90 |

O repositório contém a apresentação comercial e as definições dos pacotes. Arquivos das skills e assinaturas de serviços externos não acompanham o site. Detalhes de edição e preparação da entrega estão no [README do projeto](sites/framebuilds-ai/README.md).
