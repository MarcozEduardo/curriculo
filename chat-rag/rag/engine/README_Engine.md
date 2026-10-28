# ⚙️ Engine — algoritmos do motor RAG

Ordem de carregamento = ordem desta lista (ver `loader.js`).

| # | Arquivo (classe) | Função | Deps | UsedBy |
|---|---|---|---|---|
| 1 | `leet_normalizer.js` (`LeetNormalizer`) | Acentos, leetspeak (`m4rc0s`), letras repetidas (`oiiii`), gírias (`vc`, `pq`, `blz`). Métodos: `deburr`, `light`, `normalize`. | — | todos |
| 2 | `fuzzy.js` (`FuzzyMatcher`) | Levenshtein com corte de banda, Dice por bigramas, `blended`, `isTypo`, `tokenSetSimilarity`. Cache interno. | — | similarity, facet_detector, entity_resolver, orbit_router, memory |
| 3 | `tokenizer.js` (`Tokenizer`) | Tokens crus, remoção de stopwords e expansão de sinônimos (inclusive bigramas como "home office"). | LeetNormalizer + dicionários | ranker, facet_detector |
| 4 | `../filters/profanity_filter.js` (`ProfanityFilter`) | Moderação tolerante a leet e espaçamento. | LeetNormalizer + `profanity_list.json` | ranker |
| 4b | `../filters/input_guard.js` (`InputGuard`) | Higiene de entrada: comprimento, repetição de letras (fora de risadas), sequência numérica, código colado, tentativa de reprogramação. | `responses/input_guard.json` | ranker |
| 5 | `memory.js` (`SessionMemory`) | Nome/empresa/papel do visitante, órbita e entidade ativas, histórico, repetição, insistência em tema desconhecido, abuso e **anti-repetição de variações** (`pick`). | LeetNormalizer, FuzzyMatcher | ranker, humanizer, polarity |
| 6 | `similarity.js` (`SimilarityCalculator`) | BM25 simplificado: keyword exata 5.0, keyword fuzzy 3.2, conteúdo 1.2 (teto 4.0), título 2.0. | FuzzyMatcher | ranker (fallback) |
| 7 | `facet_detector.js` (`FacetDetector`) | Detecta a faceta (o que foi perguntado) e superlativos. Filtra palavras genéricas para não "chutar" faceta. | `mesh/facets.json` | ranker |
| 8 | `entity_resolver.js` (`EntityResolver`) | Identifica o satélite citado (projeto/empresa/curso). Só **termo distintivo** resolve; genéricos ("projeto", "trabalho") nunca. Também resolve superlativos dentro da órbita. | `data/entities.json` | ranker |
| 9 | `orbit_router.js` (`OrbitRouter`) | Índice invertido do banco mesh, correção fuzzy de tokens, pontuação de órbita, contexto pegajoso e detecção de ambiguidade. | `mesh/*` | ranker |
| 10 | `polarity.js` (`PolarityEngine`) | Peso do sim/não/talvez: resposta solta do usuário, pergunta fechada, negação e prefixo da resposta. | `responses/polarity.json` | ranker |
| 11 | `humanizer.js` (`Humanizer`) | Aberturas por confiança, uso do nome do visitante (~35%), transições, baixa confiança e ambiguidade. Preenche `{nome}`, `{empresa}`, `{entidade}`… | `responses/humanizer.json` | ranker |
| 11b | `dialog_state.js` (`DialogState`) | Árvores de aprofundamento (15+10+10+10+5 por órbita), casamento de pergunta com cobertura bidirecional, oferta de continuação (filhos → facetas do satélite → raízes da órbita) e resolução da resposta curta do visitante (rótulo, número, ordinal, sim, não). | `mesh/deepening/*.json`, `responses/dialog_followups.json`, Tokenizer, FuzzyMatcher, SessionMemory | ranker |
| 11c | `reaction_engine.js` (`ReactionEngine`) | Hostilidade (crítica ao candidato), palavras quentes, reações a teste (debug, solto, gostei, teste, ping, doubt, repeat, humano, recomendação) e respostas vagas em 3 baldes. Toda saída aponta para um caminho. | `responses/reactions.json`, `responses/hostility.json`, `mesh/hot_words.json`, DialogState | ranker |
| 12 | `ranker.js` (`RagRanker`) | Orquestrador do pipeline. Prioriza escolhas explícitas de tópico, mantém contexto só para continuações reconhecidas e recusa detalhes sem dado confirmado. API: `init()`, `answer(texto)`, `stats()`, `suggestions()`. | todos + `mesh/topic_choices.json` | `chat/chat_agent.js` |

---

## Contrato de `answer()`

```js
{
  text: "resposta em markdown simples",
  source: "Portfólio · Projetos · Dama Orbital", // badge
  orbit: "projetos",
  facet: "tecnologias",
  entity: "proj_dama_orbital",
  confidence: 16.7
}
```

## Como depurar

```js
const r = new RagRanker();
await r.init();                 // devolve stats do motor
r.answer("quais tecnolgias do dama orbtial?");
r.memory.stats();               // estado da sessão
r.lexicalCoverage(r.tokenizer.tokenize("texto", { expand: false }));
```

Fora do navegador: `node tools/test_engine.mjs` (simula window/fetch e roda a bateria de perguntas).


## Regras novas do ranker (v3.4)

- **`answer()` é um invólucro** que chama `_answer()` e depois `ensureForwardPath()`: nenhuma resposta (exceto despedida e `action: "reset"`) termina sem oferta de continuação rastreada.
- **Ordem de precedência:** guard → palavrão (escada de 3 níveis) → hostilidade → identidade → resposta à oferta pendente → palavra quente / reação / vago → **nó de texto idêntico** → small talk → ... → nó por cobertura → **recuperação léxica** → roteamento por órbita.
- **Recuperação léxica (`retrieveFallback`)**: indexa todas as respostas; termo inexistente vira "não tenho registro de X"; termo existente devolve o trecho que o cita (curto e focado, órbita provável como desempate).
- **Pronome como sinal:** "você" (o chat) e "ele" (o Marcos) separam nós; sinônimo nunca cobre pronome.
- **Escada de moderação:** `profanity_response.json` → `niveis` 1, 2, 3 (reset). `resetSession({abuseCarry})` limpa a sessão.
