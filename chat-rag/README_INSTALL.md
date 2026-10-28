# 📦 Guia de instalação do Bobby (HTML puro, sem React, sem build)

Este guia foi escrito para que **outra pessoa ou outra IA** instale o chat em qualquer site estático. O bundle é **100% JavaScript puro + JSON + CSS**. Não há React, não há framework, não há etapa de compilação.

> Sobre a pasta `src/` deste repositório: ela é apenas a **página de preview** (Next.js) usada para testar o bundle neste ambiente. **Não é necessária** para instalar o chat. Tudo o que o chat precisa está em `public/chat-rag/`.

---

## 1. O que copiar

Copie a pasta inteira `chat-rag/` para a raiz pública do seu site (ou qualquer subpasta). Estrutura mínima obrigatória:

```
chat-rag/
├── loader.js                 ← carrega tudo na ordem certa
├── chat/   (chat.css, chat_agent.js, message_formatter.js)
├── rag/
│   ├── config.js
│   ├── engine/   (12 arquivos .js)
│   ├── filters/  (profanity_filter.js, input_guard.js)
│   ├── dictionary/ (4 .json)
│   ├── responses/  (11 .json)
│   ├── templates/  (response_templates.json)
│   └── mesh/
│       ├── orbits.json · facets.json · topic_choices.json · question_templates.json
│       ├── questions/  (gerados: 1 .json por órbita + manifest.json)
│       └── deepening/  (11 árvores .json + manifest.json)
└── data/   (entities.json, knowledge_base.json)
```

Nada pode ser movido individualmente: os caminhos são resolvidos a partir de onde o `loader.js` está.

---

## 2. HTML mínimo

Cole no `<head>`:

```html
<link rel="stylesheet" href="/chat-rag/chat/chat.css">
<!-- Ícones (opcional). Se não quiser Font Awesome, troque os <i> por emoji/texto. -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
  :root {
    --orange: #FF7A2E;
    --orange-dark: #D9540A;
    --orange-deep: #B8420A;
    --cream: #FFF7EE;
    --ink: #1F1B18;
  }
  body.modal-open { overflow: hidden; }
</style>
```

Cole antes de `</body>`:

```html
<button id="chatBtn" class="chat-fab" type="button">
  <i class="fa-solid fa-comment-dots"></i> Conversar com o Bobby
</button>

<div class="chat-modal" id="chatModal" role="dialog" aria-modal="true" aria-label="Chat com Bobby">
  <div class="chat-box">
    <header class="chat-header">
      <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="chat-header-info">
        <h3>Bobby</h3>
        <p><span class="chat-status-dot"></span>RAG local · currículo do Marcos</p>
      </div>
      <button class="chat-close" id="chatClose" type="button" aria-label="Fechar">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </header>
    <div class="chat-messages" id="chatMessages"></div>
    <div class="chat-engine-note" id="chatEngineNote">carregando motor...</div>
    <div class="chat-input-area">
      <input type="text" id="chatInput" placeholder="Pergunte algo sobre o Marcos..." autocomplete="off" maxlength="400">
      <button class="chat-send-btn" id="chatSend" type="button" aria-label="Enviar">
        <i class="fa-solid fa-paper-plane"></i>
      </button>
    </div>
  </div>
</div>

<!-- Configuração opcional: DEVE vir antes do loader -->
<script>
  window.RAG_CONFIG = {
    telemetryEnabled: false      // true + telemetryEndpoint se você tiver um backend
    // telemetryEndpoint: "/api/chat/log"
  };
</script>
<script src="/chat-rag/loader.js" defer></script>
```

IDs obrigatórios: `chatBtn`, `chatModal`, `chatClose`, `chatMessages`, `chatInput`, `chatSend`. Opcional: `chatEngineNote`.

---

## 3. Requisitos de hospedagem

- Qualquer servidor estático (Vercel, Netlify, GitHub Pages, Nginx, Apache, S3).
- **Não funciona abrindo o arquivo por `file://`**: o motor carrega JSON via `fetch`. Use um servidor local para testar (`npx serve .`, `python -m http.server`).
- O caminho base é detectado automaticamente a partir do `src` do `loader.js`. Se publicar em subpasta (ex.: `/site/chat-rag/loader.js`), funciona sem mudar nada.

---

## 4. Ordem de carregamento (se não usar o loader)

```html
<script src="chat-rag/rag/config.js"></script>
<script src="chat-rag/rag/engine/leet_normalizer.js"></script>
<script src="chat-rag/rag/engine/fuzzy.js"></script>
<script src="chat-rag/rag/engine/tokenizer.js"></script>
<script src="chat-rag/rag/filters/profanity_filter.js"></script>
<script src="chat-rag/rag/filters/input_guard.js"></script>
<script src="chat-rag/rag/engine/memory.js"></script>
<script src="chat-rag/rag/engine/similarity.js"></script>
<script src="chat-rag/rag/engine/facet_detector.js"></script>
<script src="chat-rag/rag/engine/entity_resolver.js"></script>
<script src="chat-rag/rag/engine/orbit_router.js"></script>
<script src="chat-rag/rag/engine/polarity.js"></script>
<script src="chat-rag/rag/engine/humanizer.js"></script>
<script src="chat-rag/rag/engine/dialog_state.js"></script>
<script src="chat-rag/rag/engine/reaction_engine.js"></script>
<script src="chat-rag/rag/engine/ranker.js"></script>
<script src="chat-rag/chat/message_formatter.js"></script>
<script src="chat-rag/chat/chat_agent.js"></script>
```

Mudar a ordem quebra o carregamento.

---

## 5. Telemetria (opcional)

Se `telemetryEnabled: true`, o chat envia `POST` JSON para `telemetryEndpoint`:

```json
{
  "sessionId": "uuid", "question": "...", "answer": "...",
  "orbit": "projetos", "facet": "tecnologias", "entity": "proj_directsend",
  "source": "Portfólio · DirectSend", "confidence": 5,
  "visitorName": "Ana", "visitorCompany": "Acme"
}
```

Qualquer backend que aceite esse JSON serve. Falhas de rede são silenciosas: a telemetria nunca quebra o chat.

---

## 6. API JavaScript disponível na página

```js
window.BobbyChat.open();          // abre o modal
window.BobbyChat.close();         // fecha
window.BobbyChat.ask("texto");    // envia uma pergunta programaticamente
window.BobbyChat.ranker.stats();  // estatísticas do motor
```

---

## 7. Como editar o conteúdo (sem tocar em código)

| Quero... | Arquivo |
|---|---|
| Corrigir um fato de projeto, empresa ou curso | `data/entities.json` |
| Mudar a resposta de um tema (ex.: recrutamento) | `rag/mesh/orbits.json` → `facets` |
| Adicionar perguntas e respostas encadeadas (sub-assuntos) | `rag/mesh/deepening/<orbita>.json` |
| Ensinar um novo tipo de pergunta | `rag/mesh/facets.json` |
| Atalhos de menu ("condições", "stack") | `rag/mesh/topic_choices.json` |
| Textos de saudação, desvio, filtro, oferta | `rag/responses/*.json` |
| Sinônimos, stopwords, palavrões | `rag/dictionary/*.json` |
| Perguntas de recrutador fora das árvores (FAQ, layer 0) | `rag/mesh/faq_extra.json` |
| Palavras quentes (SOCRAM, LAR, hiperfoco...) | `rag/mesh/hot_words.json` |
| Reações a teste (debug, solto, gostei, ok, e aí) | `rag/responses/reactions.json` |
| Resposta a crítica ao candidato | `rag/responses/hostility.json` |
| Escada de moderação (aviso, "ainda testando?", reset) | `rag/responses/profanity_response.json` |
| Palavras de função em inglês | `rag/dictionary/english_terms.json` |

Depois de editar `orbits.json`, `entities.json`, `facets.json` ou `question_templates.json`, regenere o banco de perguntas (requer Node, só na máquina de quem edita, nunca no servidor):

```bash
node tools/build_question_bank.mjs
node tools/test_engine.mjs            # bateria básica
BATCH=DIALOG node tools/test_engine.mjs
BATCH=CHOICE node tools/test_engine.mjs
```

As árvores de `deepening/` **não** precisam de regeneração: são lidas diretamente.

---

## 8. Regras que o conteúdo deve respeitar

1. **Nunca** colocar valor de remuneração em nenhum JSON. O motor tem uma trava (`enforceSalaryPolicy`) que substitui qualquer valor por resposta institucional.
2. **Nunca** afirmar detalhe técnico que o Marcos não declarou. Se não há dado, o Bobby diz que não há.
3. Neurodivergência é tratada como **altas habilidades**. PCD/TEA/laudo só aparecem quando perguntados diretamente (faceta `vaga_afirmativa`).
4. A IA é **copiloto** do Marcos nos projetos; o Bobby em si não usa IA generativa.
5. Sem travessões no texto das respostas: humanos não escrevem assim no chat.

---

## 9. Checklist de instalação para uma IA

1. Copiar `chat-rag/` para a pasta pública do site.
2. Inserir o CSS e as variáveis `:root` no `<head>`.
3. Inserir a marcação do botão e do modal antes de `</body>`.
4. Inserir `window.RAG_CONFIG` (opcional) e depois `<script src=".../chat-rag/loader.js" defer>`.
5. Servir por HTTP e abrir o console: deve aparecer `[Bobby] motor pronto:` com `orbitas`, `variacoesDePergunta`, `aprofundamentos`.
6. Testar: "me fala do DirectSend" → "condições" (deve trocar para recrutamento) → "1" (deve escolher a primeira opção oferecida) → "kkkkkkkkk" (aceito) → "aaaaaaaaaaaa" (bloqueado).
7. Testar study case: "a história por trás da Fuga de Bobby" (deve contar do SVG em 3 horas e citar SOCRAM) e "a IA enlouquece no projeto, como ele lida?" (deve falar de ataque de ansiedade / modo metralhadora).
8. Auditar deploy (comandos em `RISK_ANALYSIS.md` §5): grep de remuneração e de travessão devem voltar vazios.


---

## 10. Comportamentos que a página hospedeira precisa conhecer

- **Reinício do chat:** quando a resposta traz `action: "reset"` (terceiro aviso de conteúdo pesado), o `chat_agent.js` mostra a mensagem, trava o campo por ~3,6 s, apaga a memória (`ranker.resetSession`) e recomeça com a saudação. Quem reincide logo depois começa no nível 2. Nada disso depende do backend.
- **Todo balão do Bobby termina em um caminho.** Se você escrever uma resposta nova em JSON, não precisa colocar pergunta de continuação: o motor anexa a oferta.
- **Pergunta em inglês:** o Bobby entende o básico e avisa uma vez que a base está em português.
- **Testes rápidos:** `node tools/stress_test.mjs` (2.600+ perguntas, relatório em `tools/reports/`). Rode antes de publicar qualquer mudança em JSON.
