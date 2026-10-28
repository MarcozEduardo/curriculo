# 📜 HISTÓRICO COMPLETO DE ARQUIVOS EDITADOS & EVOLUÇÃO

> Registro de todas as iterações, refatorações, modularizações e criações de arquivos deste projeto.

---

## 📊 Sumário da Sessão de Refatoração Canônica

| Arquivo | Tipo | Linhas Aprox. | Propósito |
|---|---|---|---|
| `NEXT_IA_HANDOFF.md` | Doc Raiz | ~90 | Carta aberta e diretrizes para a próxima IA |
| `README_Curriculo.md` | Doc Raiz | ~160 | Manifesto oficial de arquitetura e inicialização |
| `DEPENDENCY_MAP.md` | Doc Raiz | ~130 | Grafo de dependências e análise de risco de edição |
| `EDIT_GUIDE.md` | Doc Raiz | ~90 | Receitas de edição segura para cada cenário |
| `HISTORICO_VACILOS.md` | Doc Raiz | ~50 | Registro honesto de cagadas, desvios e correções |
| `IDEIAS_PENDENTES.md` | Doc Raiz | ~40 | Backlog de melhorias (incluindo o refino do PCD) |
| `HISTORICO_EDICOES.md` | Doc Raiz | ~80 | Este log de modificações e versões |
| `index.html` | HTML | ~460 | Entrada semântica, grid 2 colunas, conexões de scripts |
| `css/layout.css` | CSS | ~160 | Reset, grid, variáveis, modais, toast e wallpaper Tech |
| `css/header.css` | CSS | ~180 | Topo estilo App, foto ampliada + botão câmera |
| `css/projects.css` | CSS | ~170 | Grid 2 colunas, categorias de projetos, badges e autor |
| `css/experience.css` | CSS | ~180 | Linha do tempo, pills de habilidades, formação e PCD |
| `css/chat.css` | CSS | ~240 | Modal do Bobby, markdown, bullets, badges de fonte |
| `css/mobile.css` | CSS | ~160 | Abas móveis, sticky mini-header e responsividade |
| `css/print-a4.css` | CSS | ~110 | Regras exclusivas de impressão e exportação A4 limpa |
| `data/curriculum.json` | JSON | ~200 | Dados estruturados (10 projetos, perfil, notas) |
| `data/knowledge_base.json` | JSON | ~140 | 16 chunks semânticos para o motor RAG |
| `js/ui.js` | JS | ~170 | Clipboard, toasts, modais, scroll spy e motor PDF A4 |
| `js/chat/message_formatter.js` | JS | ~35 | Parser de markdown simples (negrito, tópicos, links) |
| `js/chat/chat_agent.js` | JS | ~140 | Orquestrador do chat Bobby integrado ao RagRanker |
| `rag/engine/leet_normalizer.js` | JS | ~30 | Normalizador de leetspeak (m4rc0s -> marcos) |
| `rag/engine/fuzzy.js` | JS | ~60 | Algoritmo Levenshtein para tolerância a digitação |
| `rag/engine/tokenizer.js` | JS | ~65 | Limpeza de acentos, stopwords e expansão de sinônimos |
| `rag/filters/profanity_filter.js` | JS | ~45 | Filtro de linguagem inapropriada com leet |
| `rag/engine/memory.js` | JS | ~90 | Extrator de nome do visitante e detecção de repetição |
| `rag/engine/similarity.js` | JS | ~35 | Cálculo de similaridade BM25 com fuzzy |
| `rag/engine/ranker.js` | JS | ~180 | Orquestrador principal de busca, FAQ de RH e templates |
| `rag/dictionary/*.json` (4 arqs) | JSON | ~50 | Stopwords, sinônimos, palavrões e termos de RH |
| `rag/templates/response_templates.json` | JSON | ~30 | Templates com placeholders dinâmicos |
| `rag/responses/*.json` (12 arqs) | JSON | ~150 | Banco de respostas ricas por categoria temática |

---

## 🔄 Marcos Principais Atingidos
- **Marco 1:** Fatiamento do monólito original de 1399 linhas em módulos especializados (< 200 linhas/arquivo).
- **Marco 2:** Criação do motor RAG client-side avançado (Leetspeak, Fuzzy Levenshtein, BM25, Memória de Sessão e Extração de Nome).
- **Marco 3:** Integração do gerador de PDF A4 de alta definição com links clicáveis e modo capture.
- **Marco 4:** Documentação integral e transparente de arquitetura, governança e handoff para a próxima IA.

---

## 🔄 Sessão 2: Header Dual + Modo Leitura Focada + 5 Seções

### Marco 5: Header dual (expandida + compacta)
- Header grande rola naturalmente como conteúdo (não trava)
- Quando sai da viewport, desliza por cima uma header compacta fixa
- Foto 52px, nome completo em 1 linha, role, telefone WhatsApp com ícone Zap verde, GitHub só ícone
- Histerese no scroll evita flapping
- Clicar na foto volta ao topo

### Marco 6: Nav Modo Leitura Focada
- Barra de pills na header expandida (Perfil, Formação, Skills, Projetos, Experiências)
- Barra compacta que desce junto da header compacta (com textura diagonal laranja)
- Overlay holograma (barra azul-escuro com ponto ciano, backdrop com blur, fade-in suave)

### Marco 7: 5 seções narrativas em `sections/`
- `perfil.html` (53 linhas) · bio em 1ª pessoa, transição como força, neurodivergência como contexto
- `formacao.html` (48 linhas) · Unyleya, CS50, cursos desde 2007, reflexão sobre reconhecimento vs. invocação
- `projetos.html` (141 linhas) · bloco de stats, origens (eletrônica, mods CS, DVD), 5 games, ferramentas, Franzinha, Nexus
- `skills.html` (154 linhas) · sidebar de 7 painéis, cada um com bloco amarelo de honestidade técnica + painel Altas Habilidades
- `experiencias.html` (85 linhas) · timeline de 6 blocos (Friends → Dokas → Oi → Prepara → Fabricart → Bella Arte → 2024)

### Marco 8: Servidor Node puro + bat
- `server.js` (77 linhas, zero dependência)
- `start.bat` (19 linhas, sobe + abre navegador)
- Necessário porque `fetch()` não funciona em `file://`

### Marco 9: Documentação modular
- `sections/README_Sections.md` (62 linhas)
- `css/focus-sidebar.css` (177 linhas)
- `css/focus-mode.css` expandido (338 linhas)
- `css/focus-nav-compact.css` (78 linhas)

### Vacilos desta sessão
- `css/header.css` estourou 200 linhas (chegou a 309)
- `focus-mode.css` estourou (338 linhas)
- Tentei editar header 2x antes de checar se `Edit A` já estava aplicado
- Confusão de tag `bobcode` minúsculo vs `BobCode` custou 2 rodadas
- Escrevi `<strong>` desbalanceado no painel Altas Habilidades (corrigido)
- Listei games faltando 2 no `projetos.html` (corrigido depois)

### Pendências no backlog
- Dividir `css/header.css` em `header.css` + `header-compact.css`
- Dividir `css/focus-mode.css` em `focus-mode.css` + `focus-doc.css`
- Adicionar persistência da última tab ativa no `focus-mode.js`
- Tornar os contatos em `perfil.html` clicáveis (`<a>` real)
