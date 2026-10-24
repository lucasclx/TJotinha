# Questões de treino (estilo VUNESP)

Questões de múltipla escolha (A–E) baseadas nos artigos do Bloco II (Lei Seca TJ-SP 2027).

- `index.json`: `[{ slug, materia, arquivo, total }]`
- `<slug>.json`: `{ materia, slug, questoes: [...] }`

Cada questão:

```json
{
  "id": "penal-001",
  "lei": "cp",
  "artigos": ["cp-312"],
  "tema": "Peculato culposo",
  "dificuldade": "facil | media | dificil",
  "enunciado": "...",
  "alternativas": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
  "gabarito": "C",
  "comentario": "..."
}
```

`lei` e `artigos` usam os mesmos ids das âncoras do HTML (`section.law` e `article.art`), então dá para linkar cada questão ao artigo correspondente.
