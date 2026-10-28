# 🗺️ MAPA DE DEPENDÊNCIAS DO PROJETO

> Use este arquivo para saber o impacto de qualquer alteração antes de editar código.

---

## 📊 Grafo Visual de Dependências

```text
index.html
├── [CSS]
│   ├── layout.css
│   │   └── define: --orange, --ink, .card, .sheet, .toast, .link-confirm-modal
│   ├── header.css          ← usa: layout.css (--orange, --radius-xl)
│   ├── projects.css        ← usa: layout.css (--orange, --border-light)
│   ├── experience.css      ← usa: layout.css (--orange, --cream)
│   ├── chat.css            ← usa: layout.css (--orange, --cream)
│   ├── mobile.css          ← usa: layout.css, header.css
│   └── print-a4.css        ← sobrepõe: TODOS os CSSs acima em .capture-mode
│
├── [JS / ENGINE RAG]
│   ├── leet_normalizer.js  (global: LeetNormalizer)
│   ├── fuzzy.js            (global: FuzzyMatcher)
│   ├── tokenizer.js        (global: Tokenizer)
│   │   ├── usa: LeetNormalizer
│   │   └── carrega async: rag/dictionary/stopwords_pt.json
│   │                      rag/dictionary/synonyms.json
│   ├── profanity_filter.js (global: ProfanityFilter)
│   │   ├── usa: LeetNormalizer
│   │   └── carrega async: rag/dictionary/profanity_list.json
│   ├── memory.js           (global: SessionMemory)
│   │   └── independente (mantém estado em RAM)
│   ├── similarity.js       (global: SimilarityCalculator)
│   │   └── usa: FuzzyMatcher
│   └── ranker.js           (global: RagRanker) ★ CORAÇÃO DO RAG
│       ├── usa: Tokenizer
│       ├── usa: ProfanityFilter
│       ├── usa: SessionMemory
│       ├── usa: SimilarityCalculator
│       ├── usa: FuzzyMatcher
│       └── carrega async:
│           ├── rag/templates/response_templates.json
│           ├── data/knowledge_base.json
│           └── rag/responses/*.json (12 arquivos)
│
├── [JS / CHAT UI]
│   ├── message_formatter.js (global: MessageFormatter)
│   └── chat_agent.js        (orquestrador do chat DOM)
│       ├── usa: RagRanker
│       └── usa: MessageFormatter
│
└── [JS / UI GERAL]
    └── ui.js
        ├── usa: html2pdf (CDN externo)
        └── manipula: #captureArea, #downloadPdfBtn, #toastContainer, #linkConfirmModal
```

---

## 📄 Detalhamento Arquivo por Arquivo

### `rag/engine/ranker.js` (Crítico)
- **Quem usa ele:** `js/chat/chat_agent.js`
- **De quem ele depende:**
  - `Tokenizer` (global)
  - `ProfanityFilter` (global)
  - `SessionMemory` (global)
  - `SimilarityCalculator` (global)
  - `FuzzyMatcher` (global)
  - `rag/templates/response_templates.json`
  - `data/knowledge_base.json`
  - Todos os 12 arquivos em `rag/responses/`
- **Se quebrar:** O Bobby para de responder ou responde "Carregando inteligência...".

---

### `js/chat/chat_agent.js`
- **Quem usa ele:** O modal do chat (`#chatModal`) acionado pelo botão `#chatBtn`.
- **De quem ele depende:**
  - `window.RagRanker`
  - `window.MessageFormatter`
  - Elementos DOM: `#chatModal`, `#chatBtn`, `#chatClose`, `#chatMessages`, `#chatInput`, `#chatSend`.
- **Se quebrar:** O modal abre mas fica mudo, ou nem abre.

---

### `js/ui.js`
- **Quem usa ele:** Botões de copiar contatos, botão de baixar PDF, modal do LinkedIn, abas mobile.
- **De quem ele depende:**
  - CDN `html2pdf.js`
  - Elementos DOM: `#copyPhone`, `#copyEmail`, `#copyGithub`, `#headerPhone`, `#headerGithub`, `#headerName`, `#downloadPdfBtn`, `#linkConfirmModal`, `#linkCancelBtn`, `#linkOpenBtn`, `#openLinkedin`, `#backTopBtn`, `#stickyTopBtn`, `#stickyMiniHeader`, `.tab-btn`.
- **Se quebrar:** Cópia de contatos para, PDF não baixa, LinkedIn não abre com confirmação.

---

### `css/print-a4.css`
- **Quem usa ele:** `js/ui.js` adiciona `.capture-mode` no `<body>` antes de gerar o PDF.
- **De quem ele depende:** Sobrescreve regras de todos os outros 6 CSSs quando em modo captura.
- **Se quebrar:** O PDF sai cortado, sai com fundo feio, quebra cards no meio ou renderiza botões de chat na folha impressa.

---

### `data/knowledge_base.json`
- **Quem usa ele:** `rag/engine/ranker.js` (na função `.init()`).
- **Se quebrar (JSON inválido):** O RAG cai em fallback e só responde pelas intenções de `recruiter_faq.json`.

---

### `data/curriculum.json`
- **Quem usa ele:** Serve como **fonte única da verdade** para quem for renderizar o currículo no futuro via template ou API.
- **Importante:** Mantenha sincronizado com `index.html` e `data/knowledge_base.json`.

---

## ⚠️ Tabela de Risco por Tipo de Alteração

| Se você for alterar... | Nível de Risco | O que testar depois |
|---|---|---|
| Adicionar item em `profanity_list.json` | 🟢 Baixo | Digite a palavra no chat e veja se bloqueia |
| Adicionar resposta em `rag/responses/*.json` | 🟢 Baixo | Pergunte sobre o tema e veja se vem a resposta nova |
| Mudar texto estático no `index.html` | 🟢 Baixo | Abra no navegador e veja se renderizou |
| Mudar CSS de um card específico | 🟡 Médio | Veja na tela E clique em "Baixar PDF" para ver se quebrou o A4 |
| Mudar `ranker.js` ou `similarity.js` | 🔴 Alto | Teste 10 perguntas diferentes no chat (inclusive com erros de digitação) |
| Mudar `print-a4.css` ou `ui.js` | 🔴 Alto | Baixe o PDF e abra no leitor para conferir quebras e margens |
| Mudar ordem dos scripts no `index.html` | 🔴 Alto | Abre o Console do navegador (F12) e veja se tem erro de "is not defined" |
