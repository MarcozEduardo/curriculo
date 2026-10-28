/**
 * ChatAgent - orquestra a interface do chat Bobby.
 * Deps: window.RagRanker, window.MessageFormatter, window.RAG_CONFIG.
 * DOM exigido: #chatBtn #chatModal #chatClose #chatMessages #chatInput #chatSend
 */
(function () {
  const SUGGESTED = [
    { label: "🎮 Projetos", prompt: "Me fala dos projetos do Marcão" },
    { label: "🛠️ Stack", prompt: "Qual a stack e as habilidades dele?" },
    { label: "💼 Experiência", prompt: "Qual a experiência profissional dele?" },
    { label: "🧠 Neurodivergência", prompt: "neurodivergência" },
    { label: "⚙️ Condições", prompt: "condições" },
    { label: "📅 Disponibilidade", prompt: "disponibilidade" },
    { label: "🤝 Como usa IA?", prompt: "A IA é copiloto ou faz tudo?" },
    { label: "🕹️ Bastidores", prompt: "bastidores" },
    { label: "📞 Contato", prompt: "Como entro em contato com o Marcos?" },
  ];

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  onReady(() => {
    const modal = document.getElementById("chatModal");
    const openBtn = document.getElementById("chatBtn");
    const closeBtn = document.getElementById("chatClose");
    const messages = document.getElementById("chatMessages");
    const input = document.getElementById("chatInput");
    const sendBtn = document.getElementById("chatSend");
    if (!modal || !messages || !input) return;

    const ranker = new window.RagRanker();
    let ready = false;
    let started = false;
    let busy = false;
    const sessionId =
      (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
      "s-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const bootPromise = Promise.all([
    ranker.init(),
    window.projetoEngine ? window.projetoEngine.init() : Promise.resolve()
  ]).then((results) => {
    const stats = results[0];
        ready = true;
        console.info("[Bobby] motor pronto:", stats);
        const note = document.getElementById("chatEngineNote");
        if (note && stats) {
          note.textContent = `RAG local · ${stats.orbitas} órbitas · ${stats.variacoesDePergunta} variações de pergunta · ${stats.entidades} satélites · ${stats.aprofundamentos} nós`;
        }
      })
      .catch((err) => console.error("[Bobby] falha ao iniciar motor:", err));

    /* --------------------------- Renderização -------------------------- */

    function addMessage(sender, text, options = [], source = null) {
      const wrap = document.createElement("div");
      wrap.className = `msg ${sender}`;

      const content = document.createElement("div");
      content.className = "msg-content";
      content.innerHTML = window.MessageFormatter ? window.MessageFormatter.format(text) : text;
      wrap.appendChild(content);

      if (source && sender === "bot") {
        const badge = document.createElement("div");
        badge.className = "msg-source";
        badge.innerHTML = `<i class="fa-solid fa-bookmark"></i> ${window.MessageFormatter.escape(source)}`;
        wrap.appendChild(badge);
      }

      if (options.length) {
        const box = document.createElement("div");
        box.className = "msg-options";
        options.forEach((opt) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "msg-option-btn";
          btn.textContent = opt.label;
          btn.addEventListener("click", () => handleUserMessage(opt.prompt || opt.label));
          box.appendChild(btn);
        });
        wrap.appendChild(box);
      }

      messages.appendChild(wrap);
      messages.scrollTop = messages.scrollHeight;
      return wrap;
    }

    function showTyping() {
      const el = document.createElement("div");
      el.className = "typing-indicator";
      el.id = "chatTyping";
      el.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
    }

    function hideTyping() {
      const el = document.getElementById("chatTyping");
      if (el) el.remove();
    }

    /* ---------------------------- Telemetria --------------------------- */

    function logInteraction(question, response) {
      const cfg = window.RAG_CONFIG || {};
      if (!cfg.telemetryEnabled || !cfg.telemetryEndpoint) return;
      try {
        fetch(cfg.telemetryEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            question,
            answer: response.text.slice(0, 800),
            orbit: response.orbit,
            facet: response.facet,
            entity: response.entity,
            source: response.source,
            confidence: Number(response.confidence || 0),
            visitorName: ranker.memory.userName,
            visitorCompany: ranker.memory.userCompany,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch (e) {
        /* telemetria nunca quebra o chat */
      }
    }

    /* ----------------------------- Interação --------------------------- */

    let resetCount = 0;

    /** Terceiro aviso de conteúdo pesado: trava o campo, mostra a mensagem e reinicia o chat. */
    function scheduleReset() {
      input.disabled = true;
      sendBtn && (sendBtn.disabled = true);
      window.setTimeout(() => {
        resetCount += 1;
        ranker.resetSession({ abuseCarry: resetCount >= 1 ? 1 : 0 });
        startConversation();
        input.disabled = false;
        input.value = "";
        sendBtn && (sendBtn.disabled = false);
        busy = false;
        input.focus();
      }, 3600);
    }

    async function handleUserMessage(promptText) {
      const text = String(promptText || "").trim();
      if (!text || busy) return;

      busy = true;
      sendBtn && (sendBtn.disabled = true);
      addMessage("user", text);
      input.value = "";
      showTyping();

      if (!ready) await bootPromise;

      const [minDelay, maxDelay] = (window.RAG_CONFIG && window.RAG_CONFIG.typingDelay) || [320, 720];
      const delay = minDelay + Math.random() * (maxDelay - minDelay) + Math.min(text.length * 6, 400);

      window.setTimeout(() => {
        hideTyping();
        let response;
        try {
          let projRes = window.projetoEngine ? window.projetoEngine.answer(text) : null;
          if (projRes) { // FIX SCORE LEGO: o motor já decidiu internamente, se ele devolveu, é pra usar.
            response = projRes;
          } else {
            response = ranker.answer(text);
          }
        } catch (err) {
          console.error("[Bobby] erro ao responder:", err);
          response = {
            text: "Tive um problema interno aqui. Pode repetir a pergunta? Se persistir, fale com o Marcão: **(61) 98222-7804**.",
            source: "Sistema",
          };
        }
        addMessage("bot", response.text, [], response.source);
        logInteraction(text, response);
        if (response.action === "reset") {
          scheduleReset();
          return;
        }
        busy = false;
        sendBtn && (sendBtn.disabled = false);
        input.focus();
      }, delay);
    }

    function startConversation() {
      messages.innerHTML = "";
      const greeting =
        "Olá! Eu sou o **Bobby**, o currículo conversacional do **Marcos Eduardo (Marcão)**.\n\n" +
        "Funciono como um **RAG local**: busco na base de conhecimento dele e respondo, sem IA generativa e sem inventar dado. " +
        "Pode perguntar do seu jeito, com gíria ou erro de digitação, que eu entendo.\n\n" +
        "Por onde quer começar?";
      addMessage("bot", greeting, SUGGESTED, "Assistente Bobby");
      started = true;
    }

    function openChat() {
      modal.classList.add("open");
      document.body.classList.add("modal-open");
      if (!started) startConversation();
      window.setTimeout(() => input.focus(), 150);
    }

    function closeChat() {
      modal.classList.remove("open");
      document.body.classList.remove("modal-open");
      openBtn && openBtn.focus();
    }

    openBtn && openBtn.addEventListener("click", openChat);
    closeBtn && closeBtn.addEventListener("click", closeChat);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeChat();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) closeChat();
    });
    sendBtn && sendBtn.addEventListener("click", () => handleUserMessage(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleUserMessage(input.value);
      }
    });

    // API pública para a página hospedeira
    window.BobbyChat = { open: openChat, close: closeChat, ask: handleUserMessage, ranker };
  });
})();
