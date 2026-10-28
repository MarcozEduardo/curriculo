# 📄 Currículo Interativo — Marcos Eduardo

Currículo modular com RAG local, exportação PDF A4 e interface estilo App.

---

## 🎯 Objetivo

Migrar o Marcão para uma vaga em TI (Suporte / QA / Analista / AI Ops / Dev Assistido por IA). Precisa passar por ATS, ser clicável, funcionar em mobile e demonstrar orquestração modular.

---

## 🗂️ Mapa da Arquitetura

```text
curriculo/
├── NEXT_IA_HANDOFF.md       ← LEIA PRIMEIRO se você é uma IA nova
├── README_Curriculo.md      ← Este arquivo (visão geral)
├── DEPENDENCY_MAP.md        ← Quem depende de quem (evita quebrar)
├── EDIT_GUIDE.md            ← Receitas de edição segura por cenário
├── HISTORICO_EDICOES.md     ← Log de arquivos alterados
├── HISTORICO_VACILOS.md     ← Cagadas cometidas + como evitar
├── IDEIAS_PENDENTES.md      ← O que ainda falta segundo a visão do Marcão
│
├── index.html               ← HTML semântico único (entrada)
│
├── css/                     ← 7 folhas de estilo modulares (ver css/README_Css.md)
│   ├── layout.css           ← Base, grid, wallpaper, modais globais
│   ├── header.css           ← Topo estilo App
│   ├── projects.css         ← Cards de projeto + status badges
│   ├── experience.css       ← Timeline + skills + PCD card
│   ├── chat.css             ← Modal do Bobby + markdown + typing
│   ├── mobile.css           ← Tabs, sticky, responsivo
│   └── print-a4.css         ← Regras EXCLUSIVAS de PDF/impressão
│
├── data/                    ← Fonte da verdade dos dados (ver data/README_Data.md)
│   ├── curriculum.json      ← Perfil, projetos, habilidades, formação
│   └── knowledge_base.json  ← Chunks semânticos para busca RAG
│
├── js/                      ← Scripts de UI (ver js/README_Js.md)
│   ├── ui.js                ← Clipboard, toasts, modais, motor PDF
│   └── chat/                ← Módulos do chatbot (ver js/chat/README_Chat.md)
│       ├── message_formatter.js  ← Markdown → HTML
│       └── chat_agent.js         ← Orquestrador do Bobby
│
└── rag/                     ← MOTOR RAG (ver rag/README_Rag.md)
    ├── engine/              ← Núcleo de busca (ver rag/engine/README_Engine.md)
    │   ├── leet_normalizer.js
    │   ├── fuzzy.js
    │   ├── tokenizer.js
    │   ├── memory.js
    │   ├── similarity.js
    │   └── ranker.js        ← ORQUESTRADOR PRINCIPAL
    ├── filters/             ← Filtros de moderação (ver rag/filters/README_Filters.md)
    │   └── profanity_filter.js
    ├── dictionary/          ← Dicionários editáveis (ver rag/dictionary/README_Dictionary.md)
    │   ├── stopwords_pt.json
    │   ├── profanity_list.json
    │   ├── synonyms.json
    │   └── recruiter_terms.json
    ├── templates/           ← Templates de resposta (ver rag/templates/README_Templates.md)
    │   └── response_templates.json
    └── responses/           ← Banco de respostas por tópico (ver rag/responses/README_Responses.md)
        ├── greeting.json          ← Saudações
        ├── about_marcos.json      ← Sobre o Marcos
        ├── skills_tech.json       ← Stack técnica
        ├── projects.json          ← Projetos e deploys
        ├── experience.json        ← Trajetória profissional
        ├── contact.json           ← Contatos oficiais
        ├── pcd_neuro.json         ← Enquadramento TEA/PCD
        ├── ia_meta.json           ← Identidade do Bobby
        ├── recruiter_faq.json     ← Intenções de recrutador
        ├── off_topic.json         ← Fuga de escopo
        ├── repeat_detection.json  ← Detecção de repetição
        └── profanity_response.json ← Moderação
```

---

## 🚀 Fluxo de Inicialização (o que acontece quando abre o HTML)

1. `index.html` carrega os 7 CSSs em ordem: `layout → header → projects → experience → chat → mobile → print-a4`.
2. Depois carrega os scripts na ordem crítica:
   ```
   rag/engine/leet_normalizer.js
   rag/engine/fuzzy.js
   rag/engine/tokenizer.js
   rag/filters/profanity_filter.js
   rag/engine/memory.js
   rag/engine/similarity.js
   rag/engine/ranker.js       ← Depende de TODOS acima
   js/chat/message_formatter.js
   js/chat/chat_agent.js      ← Depende de RagRanker + MessageFormatter
   js/ui.js                   ← Independente (mas usa html2pdf externo)
   ```
3. Quando o DOM carrega:
   - `ui.js` bind clipboard/toast/modal/PDF.
   - `chat_agent.js` instancia `RagRanker` e chama `.init()` (async: carrega JSONs).

---

## 🎨 Sistema de Cores (Design System)

Definido em `css/layout.css` como CSS Variables:

| Token | Valor | Uso |
|---|---|---|
| `--orange` | `#FF7A2E` | Cor principal (badges, botões, borda de destaque) |
| `--orange-dark` | `#D9540A` | Hover e ícones secundários |
| `--orange-deep` | `#B8420A` | Contornos e destaques de título |
| `--cream` | `#FFF7EE` | Fundo suave, pills |
| `--ink` | `#1F1B18` | Texto principal |
| `--gray` | `#5F5953` | Texto secundário |
| `--border-light` | `#D5C8B7` | Borda dos cards |

### Camadas visuais (do fundo para o topo):
1. **Body:** `#D2C9BD` (mesa/wallpaper)
2. **Sheet (folha):** `#FAF8F5` (papel canson)
3. **Cards:** `#FFFFFF` (branco puro com borda + sombra)

---

## 📦 Dependências Externas (CDN)

- `font-awesome/6.5.1` — ícones
- `Google Fonts Poppins + Inter` — tipografia
- `html2pdf.js/0.10.1` — motor de exportação PDF

---

## 🧭 Onde começar dependendo do que você quer fazer:

| Objetivo | Arquivo a abrir primeiro |
|---|---|
| Adicionar novo projeto | `data/curriculum.json` + `data/knowledge_base.json` |
| Ajustar cor/layout | `css/layout.css` (tokens) + arquivo específico |
| Corrigir bug do PDF | `css/print-a4.css` + `js/ui.js` (função `downloadCurriculumPDF`) |
| Ensinar nova pergunta ao Bobby | `rag/responses/recruiter_faq.json` (adicionar intent) |
| Bloquear novo palavrão | `rag/dictionary/profanity_list.json` |
| Adicionar sinônimo técnico | `rag/dictionary/synonyms.json` |
| Mudar tom das respostas | `rag/responses/[categoria].json` |
| Mudar estrutura do chat | `js/chat/chat_agent.js` |
| Mudar formatação markdown do chat | `js/chat/message_formatter.js` |

---

## ⚠️ Regras de Ouro

1. **Módulos ≤ 200 linhas.** Se passar, quebre.
2. **`edit_file` cirúrgico** para 1 linha. `write_file` só para arquivos novos.
3. **Nunca cite BobBuild** nos arquivos deste currículo.
4. **Sempre atualize `HISTORICO_EDICOES.md`** ao modificar algo.
5. **Confesse vacilos em `HISTORICO_VACILOS.md`.**
