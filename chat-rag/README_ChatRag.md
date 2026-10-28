# 🤖 Bundle Chat + RAG, Currículo Interativo (v3.4 "Mesh")

> 🛡️ **Análise de riscos (2 rodadas) e checklist de deploy: [`RISK_ANALYSIS.md`](RISK_ANALYSIS.md).**
> 🧪 **Testador de stress: `node tools/stress_test.mjs` (2.600+ perguntas, relatório em `tools/reports/`).**

> 🧭 **Instalação em HTML puro (sem React, sem build): veja [`README_INSTALL.md`](README_INSTALL.md).** A pasta `src/` deste repositório é só a página de preview.

> **Bobby é um conceito**, não um mascote: é o estilo de trabalho do Marcos traduzido em software — hiperfoco, contexto mapeado em camadas e resposta só depois de entender o problema inteiro.
>
> 🔒 **Política de remuneração:** nenhum valor salarial é informado. A faceta `pretensao` responde sempre "a combinar, compatível com a faixa da posição" e há trava no motor (`enforceSalaryPolicy`) aplicada a toda saída.

Módulo autônomo de **chat conversacional com RAG client-side**, em **JavaScript puro** (sem React, sem build, sem dependência externa). Pode ser aberto isolado (`demo.html`) ou embutido em qualquer página.

---

## 🧠 Conceito: rede MESH de órbitas

A base não é uma lista de respostas: é uma **rede**.

```
ÓRBITA (grande tema)
   └── SATÉLITE / ENTIDADE (assunto que orbita o tema)
          └── FACETA (o que está sendo perguntado)
                 └── VARIAÇÕES de resposta (escolhidas sem repetir)
```

A **mesma pergunta muda de resposta conforme a órbita e o satélite ativos**:

| Pergunta | Contexto | Resposta |
|---|---|---|
| "Quanto tempo levou?" | DirectSend ativo | Informa que não há duração confirmada, sem chutar |
| "Quanto tempo ficou na Bella Arte?" | Bella Arte citada | "5 anos e 4 meses", dado do currículo |
| "Quais tecnologias?" | DirectSend citado | JavaScript, WebRTC e QR Code |
| "Quais tecnologias?" | sem projeto citado | Stack geral, organizada por área |
| "Condições" | após falar de qualquer projeto | Muda para Recrutamento e limpa a entidade anterior |

Órbitas atuais: `identidade_visitante`, `sobre_marcos`, `historia_pessoal`, `projetos`, `skills`, `experiencia`, `formacao`, `neurodivergencia`, `contato`, `recrutamento`, `transparencia`, `meta_ia`, `smalltalk`.

> Neurodivergência é tratada como **altas habilidades**. PCD, TEA e laudo só aparecem quando o visitante pergunta diretamente (faceta `vaga_afirmativa`).

---

## 📦 Estrutura

```
chat-rag/
├── README_ChatRag.md          ← este manifesto
├── demo.html                  ← página de teste standalone
├── loader.js                  ← carrega o bundle na ordem correta
├── chat/                      ← camada de interface
│   ├── chat_agent.js · message_formatter.js · chat.css
├── rag/
│   ├── config.js              ← base de URL, versão, telemetria
│   ├── mesh/                  ← ★ a rede
│   │   ├── orbits.json              (órbitas + respostas por faceta)
│   │   ├── facets.json              (o que é perguntado + superlativos)
│   │   ├── question_templates.json  (frames de pergunta)
│   │   ├── topic_choices.json       (escolhas curtas e troca explícita de órbita)
│   │   ├── deepening/*.json         (★ 11 árvores de sub-assuntos, 15+10+10+10+5 cada)
│   │   └── questions/*.json         (variações GERADAS)
│   ├── engine/                ← motor de busca, contexto e ranking
│   ├── dictionary/            ← stopwords, sinônimos, palavrões, termos de RH
│   ├── filters/               ← moderação (palavrão) e higiene de entrada (repetição, números, código)
│   └── responses/             ← comportamento conversacional (JSON)
└── data/
    ├── entities.json          ← satélites (projetos, empresas, cursos) + facetas
    └── knowledge_base.json    ← chunks de fallback semântico
```

---

## 🔗 Mapa de dependências

| Arquivo | deps | usedBy |
|---|---|---|
| `rag/config.js` | — | todos (define `RAG_URL`) |
| `engine/leet_normalizer.js` | — | tokenizer, profanity_filter, memory, entity_resolver |
| `engine/fuzzy.js` | — | similarity, facet_detector, entity_resolver, orbit_router, memory |
| `engine/tokenizer.js` | LeetNormalizer, `dictionary/stopwords_pt.json`, `dictionary/synonyms.json` | ranker, facet_detector, orbit_router |
| `filters/profanity_filter.js` | LeetNormalizer, `dictionary/profanity_list.json` | ranker |
| `engine/memory.js` | LeetNormalizer, FuzzyMatcher | ranker, humanizer, polarity |
| `engine/similarity.js` | FuzzyMatcher, LeetNormalizer | ranker (fallback de KB) |
| `engine/facet_detector.js` | `mesh/facets.json`, Tokenizer, FuzzyMatcher | ranker |
| `engine/entity_resolver.js` | `data/entities.json`, FuzzyMatcher | ranker |
| `engine/orbit_router.js` | `mesh/orbits.json`, `mesh/questions/*.json`, FuzzyMatcher | ranker |
| `mesh/topic_choices.json` | aliases de escolhas curtas como "condições" e "stack" | ranker |
| `engine/polarity.js` | `responses/polarity.json` | ranker |
| `engine/humanizer.js` | `responses/humanizer.json`, SessionMemory | ranker |
| `engine/dialog_state.js` | `mesh/deepening/*.json`, `responses/dialog_followups.json`, Tokenizer, FuzzyMatcher, SessionMemory | ranker |
| `filters/input_guard.js` | `responses/input_guard.json` | ranker |
| `engine/ranker.js` | **todos acima** + `responses/*.json` + `data/knowledge_base.json` | chat_agent |
| `chat/message_formatter.js` | — | chat_agent |
| `chat/chat_agent.js` | RagRanker, MessageFormatter, RAG_CONFIG | página hospedeira |

---

## 🚀 Como carregar

**Opção 1 (recomendada):** uma linha só, ordem garantida pelo loader.

```html
<link rel="stylesheet" href="/chat-rag/chat/chat.css">
<script src="/chat-rag/loader.js" defer></script>
```

**Opção 2:** os 17 `<script>` na ordem exata, listados em `README_INSTALL.md` e em `demo.html`. Mudar a ordem quebra.

---

## 📄 DOM exigido

IDs: `#chatBtn`, `#chatModal`, `#chatClose`, `#chatMessages`, `#chatInput`, `#chatSend` (opcional: `#chatEngineNote`). A marcação completa está em `demo.html` e em `src/components/chat-mount.tsx`.

Variáveis de CSS esperadas: `--orange`, `--orange-dark`, `--orange-deep`, `--cream`, `--ink`.

---

## 🔄 Fluxo de uma resposta (`ranker.answer`)

0. Higiene da entrada (`InputGuard`): mensagem longa demais, repetição de letras fora de risada, sequência numérica longa, código colado ou tentativa de reprogramar o bot são recusados antes de qualquer busca
1. Normalização (acentos, leetspeak, gírias, letras repetidas)
2. Moderação (palavrão → advertência com escalonamento)
2b. **Resposta à oferta pendente** (`DialogState`): se o Bobby ofereceu "A, B ou C" na resposta anterior, uma resposta curta (rótulo, número, "sim", "não") é resolvida aqui
3. Identidade do visitante (nome, empresa, papel) e memória
4. Resposta solta: sim / não / talvez
5. Saudação e small talk
6. Perguntas sobre o próprio visitante ("você sabe quem eu sou?")
7. Correção do usuário ("não, eu disse Marketbobby")
8. Resolução de **escolha explícita** ("condições", "stack", "projetos") antes do contexto anterior
9. Resolução de **entidade** (fuzzy, só por termo distintivo)
9b. **Árvores de aprofundamento**: pergunta que casa com um nó (cobertura nos dois sentidos) é respondida pelo nó e oferece os sub-assuntos filhos
10. Detecção de **faceta** + **superlativo**, com checagem de dados suficientes para comparar
11. Continuação contextual apenas quando há faceta reconhecida ou marcador explícito ("e o desafio?")
12. Composição: entidade → órbita → base, sem substituir detalhes ausentes por suposições
13. Polaridade, humanização, anti-repetição, memória e citação de fonte
14. **Oferta de continuação** anexada a toda resposta substantiva e registrada como pendente

---

## ✍️ Como editar / ampliar

| Quero... | Edito |
|---|---|
| Novo projeto/empresa/curso | `data/entities.json` (com `meta` e `facets`) |
| Nova resposta de um tema | `rag/mesh/orbits.json` → `facets` da órbita |
| Novo tipo de pergunta | `rag/mesh/facets.json` (triggers + regex) |
| Mais variações de pergunta | `rag/mesh/question_templates.json` e rodar o gerador |
| Sub-assuntos encadeados (15+10+10+10+5) | `rag/mesh/deepening/<orbita>.json` (ver `README_Deepening.md`) |
| Study case de um projeto (história por trás) | `data/entities.json` → facet `study_case` da entidade |
| Processo de trabalho / debugging / IA em surto | `rag/mesh/orbits.json` → facet `processo` da órbita projetos |
| Comportamento conversacional | `rag/responses/*.json` |
| Palavrões / sinônimos / stopwords | `rag/dictionary/*.json` |

Depois de mexer em órbitas, entidades ou templates:

```bash
node tools/build_question_bank.mjs   # regenera rag/mesh/questions/*.json
node tools/test_engine.mjs           # bateria de regressão fora do navegador
```

---

## 🤝 IA como copiloto

O RAG do **Bobby** não usa geração de texto. Ele busca e organiza o conteúdo deste currículo.

No desenvolvimento dos projetos, Marcos usa modelos de IA como **copiloto**. A base deve explicar que ele orienta a ferramenta, entende e avalia o código, decide os ajustes, depura e valida o comportamento. Não afirmar que ele digitou manualmente cada linha nem que a IA fez tudo por conta própria.

## ⚠️ Regras do bundle

1. Nunca alterar a ordem de carregamento sem atualizar este README e o `loader.js`.
2. Todo `fetch` usa `window.RAG_URL(...)` — nunca caminho relativo solto.
3. `rag/mesh/questions/*.json` é **gerado**: não editar à mão.
4. O bot **nunca inventa**: assunto fora do escopo recebe a resposta sagrada; detalhe específico ou métrica ausente recebe uma explicação contextual dizendo o que não está registrado.
