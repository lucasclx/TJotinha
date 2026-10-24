# TJotinha

Site de estudo da Lei Seca do Bloco II (Conhecimentos em Direito) do concurso de Escrevente Técnico Judiciário do TJ-SP 2027. Feito para estudar no computador.

## O que tem

- **Painel:** contagem até a prova, "continuar de onde parei", meta diária, sequência de dias, progresso por matéria e norma, ritmo sugerido e mapa de atividade.
- **Leitor por norma:** texto da lei com índice lateral de títulos e capítulos, marcação de lido, estrela, grifos em 4 cores, notas por artigo e retomada automática da última posição.
- **Busca** (`Ctrl K` ou `/`) por palavra ou por artigo (`art 312`, `312 cp`).
- **Revisão espaçada:** artigos lidos voltam em intervalos crescentes; prazos, números e penas viram lacunas.
- **Caderno** com notas, grifos e estrelas, exportável em Markdown.
- **Questões**, **resumos e mapas mentais** e **cronograma** lidos de `public/data/`.

O progresso fica só no navegador (`localStorage`). Em Ajustes dá para exportar e importar um backup.

## Estrutura

```
fonte/lei-seca-bloco-ii.html   HTML original (fonte do conteúdo)
scripts/build.py               gera public/leis, public/data/indice.json e busca.json, fontes e PDF
public/                        site estático publicado pela Vercel
  index.html, css/, js/        aplicação (JS puro, sem build)
  leis/<id>.html               texto de cada norma, carregado sob demanda
  data/                        índice, busca, questões, resumos e cronograma
```

Ids das normas: `cp`, `cpp`, `l9099pen`, `cpc`, `l9099civ`, `l12153`, `cf`, `l10261`, `l8429`, `res850`, `res963`, `lc1111`, `ri`, `nscgj`. Ids de artigo: `<norma>-<número>`, como `cp-311-A` ou `nscgj-1189`.

## Rodar localmente

```sh
python3 scripts/build.py        # só quando o HTML-fonte mudar
python3 -m http.server -d public 8000
```

## Publicação

A Vercel serve a pasta `public/` (ver `vercel.json`); não há etapa de build. Cada push na `main` publica o site.
