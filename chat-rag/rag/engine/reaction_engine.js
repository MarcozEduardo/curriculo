/**
 * ReactionEngine - entradas curtas, testes e provocações.
 *
 * Três detectores independentes (o ranker decide a ordem):
 *  - detectHostile(): crítica negativa dirigida ao candidato ou ao chat
 *    ("esse cara é péssimo"). Calma, nunca ofensiva; escala na 4ª ocorrência.
 *  - detectLight(): palavras quentes (SOCRAM, LAR, hiperfoco...), reações a
 *    testes (debug, solto, gostei, teste, repete...) e respostas vagas
 *    (ok, hum, e aí, não sei...). Toda saída aponta para um caminho.
 *  - helpers de oferta usados pelo ranker (nudge).
 *
 * Deps: LeetNormalizer, FuzzyMatcher, Tokenizer, DialogState.
 * Dados: responses/reactions.json, responses/hostility.json, mesh/hot_words.json.
 */
class ReactionEngine {
  constructor(memory, tokenizer, dialog) {
    this.memory = memory;
    this.tokenizer = tokenizer;
    this.dialog = dialog;
    this.reactions = { intents: [], vague: {}, filler: [] };
    this.hot = { hot: [], filler: [] };
    this.hostility = { strong: [], weak: [], levels: {}, options: {} };
    this.filler = new Set();
    this.hotFiller = new Set();
  }

  async init() {
    const get = async (path, fallback) => {
      try {
        const res = await fetch(window.RAG_URL(path));
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
      } catch (e) {
        console.warn("[ReactionEngine] fallback para", path, e.message || e);
        return fallback;
      }
    };
    const [reactions, hot, hostility] = await Promise.all([
      get("rag/responses/reactions.json", this.reactions),
      get("rag/mesh/hot_words.json", this.hot),
      get("rag/responses/hostility.json", this.hostility),
    ]);
    this.reactions = reactions;
    this.hot = hot;
    this.hostility = hostility;
    this.filler = new Set((reactions.filler || []).flatMap((w) => this.words(w)));
    this.hotFiller = new Set([...this.filler, ...(hot.filler || []).flatMap((w) => this.words(w))]);
    this.vagueVocab = {};
    for (const [bucket, def] of Object.entries(reactions.vague || {})) {
      this.vagueVocab[bucket] = new Set((def.tokens || []).flatMap((w) => this.words(w)));
    }
  }

  /** Tokens leves: sem acento, sem pontuação, repetição de letra reduzida. */
  words(text) {
    return window.LeetNormalizer.light(String(text || ""))
      .replace(/(.)\1{2,}/g, "$1$1")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  /** Localiza a frase (contígua) nos tokens; tolera 1 erro em palavra isolada longa. */
  locate(tokens, phrase) {
    const p = this.words(phrase);
    if (!p.length) return null;
    for (let i = 0; i <= tokens.length - p.length; i++) {
      let ok = true;
      for (let j = 0; j < p.length; j++) {
        const a = tokens[i + j];
        const b = p[j];
        if (a === b) continue;
        if (p.length === 1 && b.length >= 5 && window.FuzzyMatcher.isTypo(a, b)) continue;
        ok = false;
        break;
      }
      if (ok) return { start: i, len: p.length };
    }
    return null;
  }

  restAllowed(tokens, hit, allowed, tolerance) {
    const tol = tolerance || 0;
    let extras = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (i >= hit.start && i < hit.start + hit.len) continue;
      if (allowed.has(tokens[i])) continue;
      extras++;
      if (extras > tol) return false;
    }
    return true;
  }

  /* --------------------------- Hostilidade --------------------------- */

  detectHostile(raw) {
    const t = this.words(raw);
    if (!t.length || t.length > 16) return false;
    const joined = " " + t.join(" ") + " ";
    // perguntas legítimas sobre limitações não são hostilidade
    if (/ ponto[s]? fraco[s]? | lado fraco | fraqueza[s]? | limitac\w+ | pontos? a desenvolver /.test(joined)) return false;
    const has = (list) => (list || []).some((w) => joined.includes(" " + this.words(w).join(" ") + " "));
    if (has(this.hostility.strong)) return true;
    const isQuestion = /\?/.test(raw) || /^(qual|quais|como|onde|quando|por que|porque|quem|o que)\b/.test(t.join(" "));
    return !isQuestion && t.length <= 8 && has(this.hostility.weak);
  }

  hostileText(level) {
    const lv = String(Math.min(Math.max(level, 1), 3));
    return { list: (this.hostility.levels || {})[lv] || [], options: (this.hostility.options || {})[lv] || [] };
  }

  /* ----------------------- Quentes, reações, vagas ----------------------- */

  /**
   * @returns {null | {kind:'hot', entry} | {kind:'reaction', intent} | {kind:'vague', bucket}}
   */
  detectLight(raw) {
    const t = this.words(raw);
    if (!t.length) return { kind: "vague", bucket: "unsure" }; // só emoji ou pontuação
    if (t.length > 8) return null;

    // 1. palavras quentes
    for (const entry of this.hot.hot || []) {
      const withWords = (entry.with || []).flatMap((w) => this.words(w));
      if (withWords.length && !t.some((x) => withWords.includes(x))) continue;
      for (const w of entry.words) {
        const hit = this.locate(t, w);
        if (!hit) continue;
        const allowed = new Set([...this.hotFiller, ...withWords, ...(entry.extra || []).flatMap((w) => this.words(w))]);
        if (this.restAllowed(t, hit, allowed, 1)) return { kind: "hot", entry };
      }
    }

    // 2. reações a testes
    const joinedLight = t.join(" ");
    for (const intent of this.reactions.intents || []) {
      for (const rx of intent.regex || []) {
        try {
          if (new RegExp(rx, "i").test(joinedLight)) return { kind: "reaction", intent };
        } catch (e) { /* regex inválida: ignora */ }
      }
      for (const pattern of intent.patterns || []) {
        const hit = this.locate(t, pattern);
        if (hit && this.restAllowed(t, hit, this.filler)) return { kind: "reaction", intent };
      }
    }

    // 3. respostas vagas
    const buckets = Object.entries(this.vagueVocab || {});
    const union = new Set([...this.filler]);
    buckets.forEach(([, vocab]) => vocab.forEach((w) => union.add(w)));
    if (t.every((x) => union.has(x))) {
      for (const tok of t) {
        for (const [bucket, vocab] of buckets) if (vocab.has(tok)) return { kind: "vague", bucket };
      }
    }
    return null;
  }

  vagueLeads(bucket) {
    return (this.reactions.vague?.[bucket]?.leads) || ["Certo."];
  }
}

window.ReactionEngine = ReactionEngine;
