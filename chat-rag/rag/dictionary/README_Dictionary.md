# 📚 Dicionários

Listas léxicas em JSON puro que alimentam o NLP.

| Arquivo | Conteúdo | UsedBy | Como editar |
|---|---|---|---|
| `stopwords_pt.json` | Palavras de parada PT-BR. **Atenção:** pronomes como `eu`, `você`, `ele` foram mantidos fora da lista — eles distinguem órbitas (visitante × Bobby × Marcos). | `engine/tokenizer.js`, gerador | minúsculo, sem acento |
| `synonyms.json` | Canônico → variações (`"ts": ["typescript"]`, `"pcd": ["tea","autismo",...]`). Também expande expressões (`home office`). | `engine/tokenizer.js` | nova chave + array |
| `profanity_list.json` | Termos ofensivos para moderação (comparação tolerante a leet/espaços). | `filters/profanity_filter.js` | minúsculo, sem acento |
| `recruiter_terms.json` | Vocabulário de RH por categoria (modelo de trabalho, contratação, senioridade, benefícios, processo, cargos). | consulta auxiliar / expansão de intenção | agrupar por categoria |

> Depois de editar `stopwords_pt.json` ou `synonyms.json`, rode `node tools/build_question_bank.mjs` — o banco mesh é tokenizado na geração.
