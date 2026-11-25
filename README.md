# framebuilds.ai

Site em português para apresentar quatro pacotes de skills de IA e um combo completo. HTML, CSS e JavaScript estáticos, com catálogo pesquisável, filtros por pacote, requisitos e exemplos. Os botões exibem um aviso de vendas em breve; não há checkout ou coleta de dados.

## Publicar no Netlify

Importe o repositório `jquinteiroo/framebuilds.ai` pelo GitHub e escolha a branch `main`. O arquivo [`netlify.toml`](netlify.toml) na raiz configura o deploy:

| Campo | Valor |
| --- | --- |
| Base directory | `sites/framebuilds-ai` |
| Build command | `python scripts/build_site.py` |
| Publish directory | `dist`, relativa à base |
| Python | `3.12` |

Não é necessário instalar bibliotecas ou configurar variáveis secretas para a versão atual. Após conectar o repositório, novos commits em `main` podem ser publicados automaticamente pela integração Git do Netlify.

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
