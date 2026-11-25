# framebuilds.ai

Site em português para apresentar quatro pacotes de skills de IA e um combo completo. HTML, CSS e JavaScript, com catálogo pesquisável, filtros por pacote, requisitos e exemplos. A loja pública permanece em pré-lançamento; um fluxo separado permite testar o Checkout Pro do Mercado Pago, sem vendas reais ou entrega de arquivos.

## Publicar no Netlify

Importe o repositório `jquinteiroo/framebuilds.ai` pelo GitHub e escolha a branch `main`. O arquivo [`netlify.toml`](netlify.toml) na raiz configura o deploy:

| Campo | Valor |
| --- | --- |
| Base directory | `sites/framebuilds-ai` |
| Build command | `node test/payments.test.cjs && node test/checkout-ui.test.cjs && python scripts/build_site.py` |
| Publish directory | `dist`, relativa à base |
| Python | `3.12` |
| Node.js | `22` |
| Functions directory | `netlify/functions`, relativa à base |

Não é necessário instalar bibliotecas. Sem configuração de credenciais, os endpoints de pagamento permanecem desativados. Após conectar o repositório, novos commits em `main` podem ser publicados automaticamente pela integração Git do Netlify.

## Configurar o pagamento de teste

No projeto do Netlify, entre em **Project configuration > Environment variables** e cadastre:

| Variável | Valor |
| --- | --- |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | Access Token do ambiente **Teste** da aplicação no Mercado Pago |
| `MERCADOPAGO_WEBHOOK_SECRET` | Assinatura secreta gerada ao salvar o webhook de **Teste** |
| `MERCADOPAGO_TEST_ENABLED` | `true` |

Os valores precisam estar disponíveis às Functions. As variáveis secretas ficam no painel do Netlify, não no código nem no chat. Depois de alterar as variáveis, faça um novo deploy.

No Mercado Pago, abra **Configuração de webhooks**, mantenha **Teste**, informe `https://framebuildsai.netlify.app/.netlify/functions/mercadopago-webhook`, selecione **Order (Mercado Pago)** e salve para obter a assinatura secreta. Então cadastre essa assinatura no Netlify.

Após o deploy, abra `https://framebuildsai.netlify.app/?checkout=test#pacote`. Esse modo mostra uma faixa de teste e permite testar os cinco pacotes. A página normal continua exibindo o aviso de vendas em breve e uma entrada para o ambiente de testes. O rodapé também tem o link “Testar pagamento”. O modo de teste é mantido na mesma aba; use “Sair do teste” na faixa para retornar à loja normal. Não são liberados arquivos. Nenhum pagamento real é habilitado por essa implementação.

Consulte os [detalhes técnicos e limites](sites/framebuilds-ai/README.md#pagamentos-de-teste) antes de planejar a abertura das vendas.

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
