/**
 * RagConfig - configuração global do bundle Chat+RAG.
 * Define a base de URL usada por TODOS os fetch() do motor, para que o bundle
 * funcione tanto em /chat-rag/demo.html quanto embutido em qualquer página.
 */
(function () {
  const script = document.currentScript;
  let base = "/chat-rag/";
  if (script && script.src) {
    base = script.src.replace(/rag\/config\.js(\?.*)?$/, "");
  }
  window.RAG_CONFIG = Object.assign(
    {
      base,
      version: "3.4.1-mesh",
    telemetryEndpoint: null,
    telemetryEnabled: false,
      typingDelay: [320, 720],
      minConfidence: 2.2,
      ambiguityDelta: 0.8,
    },
    window.RAG_CONFIG || {}
  );
  window.RAG_URL = (p) => window.RAG_CONFIG.base + p.replace(/^\//, "");
})();
