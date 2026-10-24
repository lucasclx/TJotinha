# Formato dos resumos por lei

Os resumos ficam em `public/data/resumos/`, um JSON por norma do Bloco II e um `index.json` com a lista.

## `index.json`

```json
{
  "versao": 1,
  "bloco": "Bloco II — TJ-SP 2027",
  "aviso": "texto sobre a curadoria dos artigos mais cobrados",
  "leis": [
    { "slug": "cp", "lei": "Código Penal", "materia": "Direito Penal", "arquivo": "cp.json",
      "totalArtigos": 53, "maisCobrados": 12, "altaIncidencia": 9 }
  ]
}
```

## `<slug>.json`

| Campo | Tipo | Conteúdo |
| --- | --- | --- |
| `slug`, `ancora` | string | id da norma no material (`cp`, `cpp`, `l9099pen`, `cpc`, `l9099civ`, `l12153`, `cf`, `l10261`, `l8429`, `res850`, `res963`, `lc1111`, `ri`, `nscgj`) |
| `lei`, `subtitulo`, `materia` | string | nome, ementa e matéria, como no material |
| `artigosNoEdital`, `totalArtigos` | string, número | recorte do edital |
| `visaoGeral` | string | resumo da norma em um parágrafo |
| `mapaMental` | nó | árvore `{ titulo, nota?, artigos?, filhos? }` |
| `maisCobrados` | lista | `{ artigos, tema, porQueCai, pegadinha, incidencia: "alta" \| "media" }` |
| `pegadinhas` | lista de strings | armadilhas frequentes |
| `dicasDeMemorizacao` | lista de strings | macetes |

Os artigos são ids do material, no formato `<slug>-<número>` (ex.: `cp-312`, `cp-311-A`, `nscgj-1189`, `lc1111-dt-1`). Todos os ids citados foram conferidos contra o arquivo "Lei Seca Bloco II - TJ-SP 2027.html".
