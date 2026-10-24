# Cronograma de estudo

Plano dia a dia até a prova, gerado a partir do conteúdo da Lei Seca do Bloco II.

## Arquivos

| Arquivo | O que é |
| --- | --- |
| `public/data/unidades.json` | 101 unidades de estudo: trechos contínuos de uma lei, com tamanho parecido (20 a 75 min), cortados nos títulos e capítulos. |
| `public/js/cronograma/gerar.js` | Módulo ES sem dependências que monta o cronograma. O site importa direto no navegador para recalcular quando o aluno muda a data da prova ou as horas. |
| `public/data/cronograma.json` | Cronograma pronto com as premissas padrão. |
| `docs/cronograma.md` | O mesmo cronograma em texto, para conferir sem abrir o site. |

## Como o plano é montado

1. **Ciclo 1, primeira leitura:** todas as unidades, intercalando matérias em sessões de cerca de 1h. Cada unidade vem com um bloco de questões no mesmo dia. As unidades lidas num dia ganham revisões em D+1, D+7 e D+30.
2. **Ciclos 2 em diante, releituras:** mais rápidas (50%, depois 35% e 30% do tempo), com questões. Do ciclo 3 em diante entram só as leis de peso 2 e 3, e do 4 em diante só as de peso 3.
3. **Revisão semanal:** no domingo (configurável), reler grifos e anotações da semana e refazer as questões erradas.
4. **Reta final** (cerca de 12% do período, de 1 a 4 semanas): revisão geral em blocos de até 1h, das leis de maior peso para as de menor, um simulado por semana no dia com mais horas e questões mistas no tempo que sobrar. Véspera só com revisão leve.

Se o tempo não der para a primeira leitura antes da reta final, o resultado traz um aviso em `avisos`.

## Premissas (rascunho, a confirmar)

- Prova em 28/03/2027 e início em 26/10/2026.
- 2h de segunda a sexta, 4h no sábado e 1h no domingo.
- Primeira leitura a 250 caracteres por minuto (ler, grifar e anotar).
- Pesos de incidência (1 a 3) em `extrair_unidades.mjs` são estimativas a partir do histórico da VUNESP, não dados oficiais.

## Formato

`unidades.json`:

```json
{ "unidades": [ { "id": "cpc-u1", "materiaId": "m-proccivil", "materia": "Direito Processual Civil",
  "leiId": "cpc", "lei": "Código de Processo Civil", "titulo": "CPC, Arts. 144 a 155",
  "assunto": "Capítulo II · Dos impedimentos e da suspeição", "de": "cpc-144", "ate": "cpc-155",
  "nArtigos": 12, "minutos": 40, "peso": 3 } ] }
```

`de` e `ate` são os ids dos artigos no HTML (âncoras do site).

`cronograma.json` (e o retorno de `gerarCronograma(unidades, opcoes)`):

```json
{ "premissas": { "dataProva": "2027-03-28", "inicio": "2026-10-26",
    "minutosPorDia": [60,120,120,120,120,120,240], "diaRevisaoSemanal": 0, "semanasFinais": 3 },
  "resumo": { "semanas": 22, "horasTotais": 316, "horasPorTipo": {}, "fimPrimeiraLeitura": "2026-12-18",
    "ciclosIniciados": 6, "inicioRetaFinal": "2027-03-07" },
  "avisos": [],
  "semanas": [ { "n": 1, "inicio": "2026-10-26", "fim": "2026-11-01", "fase": "Ciclo 1: ...", "minutos": 780,
    "dias": [ { "data": "2026-10-26", "diaSemana": "segunda", "minutos": 100,
      "tarefas": [ { "id": "estudo-cp-u1-c1", "tipo": "estudo", "unidadeId": "cp-u1", "leiId": "cp",
        "de": "cp-293", "ate": "cp-311-A", "ciclo": 1, "minutos": 40, "descricao": "Ler CP, ..." } ] } ] } ] }
```

- `tipo`: `estudo`, `questoes`, `revisao` ou `simulado`.
- Tarefas de uma unidade têm `unidadeId`, `leiId`, `de` e `ate`. Revisões que cobrem várias unidades têm `unidades` (lista de ids).
- `id` é estável para leitura, questões e revisão final de uma unidade, para o site guardar o "feito" no `localStorage` mesmo depois de recalcular.

## Regerar

```sh
node scripts/cronograma/extrair_unidades.mjs "Lei Seca Bloco II - TJ-SP 2027.html"
node scripts/cronograma/gerar_cronograma.mjs --prova 2027-03-28 --inicio 2026-10-26 --minutos 60,120,120,120,120,120,240
```

`--minutos` vai de domingo a sábado.
