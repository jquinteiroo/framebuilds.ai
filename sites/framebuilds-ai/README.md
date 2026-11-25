# framebuilds.ai

Loja de apresentação em português, com quatro pacotes temáticos e um combo completo. Implementação estática, sem dependências, checkout, coleta de dados ou chamadas de API no frontend.

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

## Edição

- `packages.json`: fonte única de nomes, preços em centavos, benefícios, requisitos e composição dos pacotes.
- `src/index.template.html`: estrutura e conteúdo da página. Depois de editar, execute `python scripts/build_site.py`.
- `scripts/build_site.py`: valida o inventário, resolve a composição do combo e gera `dist/index.html` e `dist/packages.js`.
- `dist/index.html` e `dist/packages.js`: arquivos gerados; não edite preços diretamente neles.
- `dist/styles.css`: identidade visual e layouts responsivos.
- `dist/packages.css`: componentes dos pacotes, combo e detalhes.
- `dist/catalog.js`: inventário editorial original de 99 skills identificadas na sessão. A loja exibe apenas as 90 selecionadas na composição dos pacotes.
- `dist/app.js`: busca, filtros por categoria e pacote, menu celular, exemplos, detalhes e modais.
- `dist/assets/creator.webp`: avatar fornecido no diretório de trabalho.

## Estado de lançamento

Os botões de compra abrem o aviso de vendas em breve com o nome e o preço da oferta escolhida. Nenhuma cobrança ou envio de dados ocorre. Para ativar as vendas, definir o provedor de pagamento, a entrega, o suporte e as condições de compra, e então conectar as ações `data-purchase` ao checkout de cada oferta. Apenas alterar `salesOpen` não ativa uma cobrança; os botões permanecem no fluxo de pré-lançamento.

Os pacotes avulsos têm seleções distintas nesta versão; o combo reúne a união, sem contar uma skill duas vezes. Foram deixadas fora nove rotinas de configuração, mascotes e gestão interna. O número de skills inclui etapas de apoio de um mesmo processo e não representa um conjunto de aplicações independentes. Os requisitos por pacote aparecem em “Ver skills e requisitos”.

O catálogo descreve as skills disponíveis no ambiente do proprietário. Este projeto não empacota os arquivos das skills, não transfere contas de ferramentas e não atribui direitos de revenda sobre materiais de terceiros. Antes de disponibilizar o pacote comercial, revisar as licenças dos materiais efetivamente incluídos e confirmar a autorização de redistribuição. Skills dependentes de plugins, sistema operacional e contas exigem ambientes compatíveis. O site explicita essas dependências nas perguntas frequentes.

O site de referência foi usado para estudar a estrutura de venda. Texto, componentes e identidade desta página foram criados para framebuilds.ai. Não foram copiados depoimentos ou resultados financeiros de terceiros.
