/**
 * loader.js - carrega o bundle Chat+RAG na ORDEM correta de dependências.
 * Use um único <script src="/chat-rag/loader.js" defer></script> na página
 * hospedeira (ou os <script> individuais, como em demo.html).
 */
(function () {
  const current = document.currentScript;
  const base = current && current.src ? current.src.replace(/loader\.js(\?.*)?$/, "") : "/chat-rag/";

  const FILES = [
    "rag/config.js",
    "rag/engine/leet_normalizer.js",
    "rag/engine/fuzzy.js",
    "rag/engine/tokenizer.js",
    "rag/filters/profanity_filter.js",
    "rag/filters/input_guard.js",
    "rag/engine/memory.js",
    "rag/engine/similarity.js",
    "rag/engine/facet_detector.js",
    "rag/engine/entity_resolver.js",
    "rag/engine/orbit_router.js",
    "rag/engine/polarity.js",
    "rag/engine/humanizer.js",
    "rag/engine/dialog_state.js",
    "rag/engine/reaction_engine.js",
    "rag/engine/ranker.js",
    "chat/message_formatter.js",
  "chat/projeto_engine.js",
    "chat/chat_agent.js",
  ];

  function load(index) {
    if (index >= FILES.length) return;
    const el = document.createElement("script");
    el.src = base + FILES[index];
    el.async = false;
    el.onload = () => load(index + 1);
    el.onerror = () => console.error("[Bobby] falha ao carregar", FILES[index]);
    document.head.appendChild(el);
  }

  // garante a base correta mesmo antes do config.js rodar
  window.RAG_CONFIG = Object.assign({ base }, window.RAG_CONFIG || {});
  load(0);
})();
