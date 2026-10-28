/**
 * SessionMemory - memória de curto prazo da conversa.
 * Guarda nome/empresa do visitante, órbita e entidade ativas (contexto pegajoso),
 * histórico, contagem de repetição, insistência em tema desconhecido, abuso,
 * e o registro de respostas já usadas (anti-repetição de variações).
 */
class SessionMemory {
  constructor() {
    this.userName = null;
    this.userCompany = null;
    this.userRole = null;
    this.history = [];
    this.activeOrbit = null;
    this.activeEntity = null;
    this.lastFacet = null;
    this.topicCount = {};
    this.unknownStreak = 0;
    this.abuseCount = 0;
    this.usedVariations = new Map(); // chave -> índices já usados
    this.recentTexts = [];
    this.startedAt = Date.now();

    // Aprofundamento: a última oferta feita pelo Bobby ("posso seguir por A, B ou C"),
    // os nós de aprofundamento já respondidos e o cursor de rotação das ofertas.
    this.pendingOffer = null;
    this.pendingTurn = -1;
    this.askedNodes = new Set();
    this.offerCursor = {};

    // Teste e moderação: turno atual, última resposta (para "repete") e contagem de crítica hostil.
    this.turn = 0;
    this.lastReply = null;
    this.hostileCount = 0;
  }

  /** Uma faceta específica já foi respondida para este satélite nesta sessão? */
  facetAnswered(entityId, facet) {
    return this.history.some((h) => h.entity === entityId && h.facet === facet);
  }

  /* ----------------------------- Identidade ----------------------------- */

  extractUserName(text) {
    const clean = String(text || "").trim();
    const patterns = [
      /(?:meu nome (?:é|e)|me chamo|pode me chamar de|aqui (?:é|e) o|aqui (?:é|e) a)\s+([a-zà-ÿ]{2,20})/i,
      /^(?:sou|eu sou)\s+(?:o|a)?\s*([a-zà-ÿ]{2,20})\b/i,
    ];
    const blocked = new Set([
      "marcos", "marcao", "bobby", "recrutador", "recrutadora", "dev", "programador",
      "visitante", "eu", "uma", "um", "de", "do", "da", "rh", "tech", "lead", "gerente",
      "analista", "curioso", "humano", "pessoa", "gente",
    ]);
    for (const pat of patterns) {
      const m = clean.match(pat);
      if (m && m[1]) {
        const raw = m[1].toLowerCase();
        if (blocked.has(window.LeetNormalizer.deburr(raw))) continue;
        this.userName = raw.charAt(0).toUpperCase() + raw.slice(1);
        return this.userName;
      }
    }
    return null;
  }

  extractCompany(text) {
    const m = String(text || "").match(
      /(?:(?:sou|trabalho|venho|represento)\s+(?:d[ao]|n[ao]|a|o)?\s*(?:empresa\s+)?)([A-ZÀ-Ý][\wÀ-ÿ&.\-]{2,24}(?:\s[A-ZÀ-Ý][\wÀ-ÿ&.\-]{2,24})?)/
    );
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (!/^(rh|recrutador|recrutadora|tech|lead|dev)$/i.test(candidate)) {
        this.userCompany = candidate;
        return candidate;
      }
    }
    return null;
  }

  extractRole(text) {
    const t = window.LeetNormalizer.light(text);
    const roles = [
      ["recrutador", "recrutador(a)"], ["recrutadora", "recrutador(a)"], ["rh", "RH"],
      ["tech lead", "Tech Lead"], ["tech recruiter", "Tech Recruiter"], ["gestor", "gestor"],
      ["gerente", "gerente"], ["cto", "CTO"], ["head", "head"], ["analista de rh", "analista de RH"],
    ];
    for (const [k, label] of roles) {
      if (new RegExp(`\\b(sou|aqui e|trabalho como)\\b[^.]{0,20}\\b${k}\\b`).test(t)) {
        this.userRole = label;
        return label;
      }
    }
    return null;
  }

  salutation() {
    return this.userName ? `, ${this.userName}` : "";
  }

  companySuffix() {
    return this.userCompany ? `, da **${this.userCompany}**` : "";
  }

  /* ------------------------------ Contexto ------------------------------ */

  setContext({ orbit, entity, facet }) {
    if (orbit) this.activeOrbit = orbit;
    if (entity) this.activeEntity = entity;
    if (facet) this.lastFacet = facet;
  }

  clearActiveEntity() {
    this.activeEntity = null;
    this.lastFacet = null;
  }

  record(userText, { orbit, entity, facet, intentId, summary, clearEntity = false }) {
    const clean = window.LeetNormalizer.light(userText);
    this.history.push({
      text: clean,
      orbit: orbit || null,
      entity: entity || null,
      facet: facet || null,
      intentId: intentId || null,
      summary: summary || "",
      at: Date.now(),
    });
    if (this.history.length > 60) this.history.shift();
    this.recentTexts.push(clean);
    if (this.recentTexts.length > 8) this.recentTexts.shift();

    const key = intentId || `${orbit}:${entity || "-"}:${facet || "-"}`;
    this.topicCount[key] = (this.topicCount[key] || 0) + 1;
    this.setContext({ orbit, entity, facet });
    if (clearEntity) this.clearActiveEntity();
  }

  /* ----------------------------- Repetição ------------------------------ */

  checkRepeat(userText, key) {
    const clean = window.LeetNormalizer.light(userText);
    if (!this.history.length) return { isRepeat: false };

    const recent = this.history.slice(-4);
    const exact = recent.find((h) => h.text === clean && clean.length > 3);
    if (exact) return { isRepeat: true, summary: exact.summary, reason: "texto idêntico" };

    const similar = recent.find(
      (h) => window.FuzzyMatcher.similarity(h.text, clean) > 0.88 && clean.length > 8
    );
    if (similar) return { isRepeat: true, summary: similar.summary, reason: "texto muito parecido" };

    if (key && (this.topicCount[key] || 0) >= 2) {
      const last = [...this.history].reverse().find((h) => (h.intentId || `${h.orbit}:${h.entity || "-"}:${h.facet || "-"}`) === key);
      if (last) return { isRepeat: true, summary: last.summary, reason: "mesma intenção" };
    }
    return { isRepeat: false };
  }

  /* --------------------- Anti-repetição de variações -------------------- */

  pick(list, key = "default") {
    if (!Array.isArray(list) || list.length === 0) return "";
    if (list.length === 1) return list[0];
    const used = this.usedVariations.get(key) || [];
    // FIX 3: primeira vez retorna o indice 0 (resposta canonica do array)
    if (!used.length) {
      this.usedVariations.set(key, [0]);
      return list[0];
    }
    const available = list.map((_, i) => i).filter((i) => !used.includes(i));
    const pool = available.length ? available : list.map((_, i) => i);
    if (!available.length) this.usedVariations.set(key, []);
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const nextUsed = (this.usedVariations.get(key) || []).concat(chosen);
    this.usedVariations.set(key, nextUsed.slice(-Math.max(1, list.length - 1)));
    return list[chosen];
  }

  /* -------------------------- Estados especiais ------------------------- */

  registerUnknown() {
    this.unknownStreak += 1;
    return Math.min(this.unknownStreak, 4);
  }

  resetUnknown() {
    this.unknownStreak = 0;
  }

  recordAbuse() {
    this.abuseCount += 1;
    return this.abuseCount;
  }

  stats() {
    return {
      mensagens: this.history.length,
      orbitaAtiva: this.activeOrbit,
      entidadeAtiva: this.activeEntity,
      visitante: this.userName,
      empresa: this.userCompany,
      duracaoSegundos: Math.round((Date.now() - this.startedAt) / 1000),
    };
  }
}

window.SessionMemory = SessionMemory;
