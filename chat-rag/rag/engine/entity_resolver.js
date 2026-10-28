/**
 * EntityResolver - identifica QUAL assunto (satélite) está sendo citado:
 * projetos, empresas, cursos. Usa match exato de expressão, token distintivo e
 * fuzzy controlado. Também resolve superlativos dentro de uma órbita.
 *
 * Regra de ouro: termo genérico (projeto, trabalho, curso, jogo...) NUNCA
 * identifica entidade sozinho — senão "me fala dos projetos" viraria um projeto
 * específico. Só termos distintivos (nome próprio do satélite) resolvem.
 */
class EntityResolver {
  static GENERIC = new Set([
    "projeto", "projetos", "trabalho", "trabalhos", "atual", "hoje", "agora", "ultimo", "primeiro",
    "curso", "cursos", "formacao", "graduacao", "faculdade", "jogo", "jogos", "game", "games",
    "app", "aplicacao", "sistema", "ferramenta", "ferramentas", "multiplayer", "online", "academico",
    "emprego", "empresa", "experiencia", "tecnico", "suporte", "manutencao", "professor", "aula",
    "ensino", "logistica", "administrativo", "chat", "bot", "site", "codigo", "web", "ti", "dev",
    "nave", "luta", "rpg", "ocr", "qr", "p2p", "cnc", "2024", "2025", "21", "este", "esse", "mesmo",
    "voce", "bobby", "chatbot", "robo", "assistente", "curriculo", "inteligente", "portfolio",
    "dele", "dela", "ele", "ela", "seu", "sua", "esse", "este", "isso", "mesmo", "coisa",
    "salario", "salarial", "pretensao", "conquista", "conquistas", "resultado", "entrega",
    "principal", "principais", "maior", "menor", "melhor", "novo", "antigo", "grande",
  ]);

  constructor() {
    this.entities = [];
    this.byId = new Map();
    this.index = []; // { term, tokens, entityId, weight, phrase }
    this.tokenFreq = new Map();
  }

  async init() {
    let data = { entities: [] };
    try {
      const res = await fetch(window.RAG_URL("data/entities.json"));
      if (!res.ok) throw new Error("HTTP " + res.status);
      data = await res.json();
    } catch (e) { console.warn("[EntityResolver] entities.json indisponível.", e); }
    this.entities = data.entities || [];

    for (const e of this.entities) {
      this.byId.set(e.id, e);
      for (const term of [e.name, ...(e.aliases || [])]) {
        const norm = window.LeetNormalizer.light(term);
        const tokens = norm.split(/\s+/).filter((t) => t.length > 2);
        this.index.push({
          term: norm,
          tokens,
          entityId: e.id,
          weight: term === e.name ? 1.15 : 1,
          phrase: tokens.length > 1,
        });
        for (const t of new Set(tokens)) {
          const set = this.tokenFreq.get(t) || new Set();
          set.add(e.id);
          this.tokenFreq.set(t, set);
        }
      }
    }
    this.index.sort((a, b) => b.term.length - a.term.length);
  }

  get(id) {
    return this.byId.get(id) || null;
  }

  byOrbit(orbitId) {
    return this.entities.filter((e) => e.orbit === orbitId);
  }

  /** Token distintivo = não genérico, ≥4 letras e presente em no máximo 1 entidade. */
  isDistinctive(token) {
    // siglas e nomes curtos próprios (LAR, CS50, ABNT) continuam distintivos
    const SHORT_OK = new Set(["lar", "cs50", "abnt", "ucb", "oi"]);
    if (token.length < 4 && !SHORT_OK.has(token)) return false;
    if (EntityResolver.GENERIC.has(token)) return false;
    const owners = this.tokenFreq.get(token);
    return !!owners && owners.size === 1;
  }

  /**
   * @param {string} normalizedText texto normalizado
   * @param {string[]} rawTokens tokens SEM expansão de sinônimos
   * @returns {{entity:Object, score:number, matchedTerm:string}|null}
   */
  resolve(normalizedText, rawTokens = []) {
    const text = " " + normalizedText.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim() + " ";
    const results = new Map();
    const bump = (id, value, term) => {
      const cur = results.get(id);
      if (!cur || value > cur.score) results.set(id, { score: value, term });
    };

    // 1. expressão completa no texto ("dama orbital", "bella arte", "a fuga de bobby")
    for (const item of this.index) {
      if (item.term.length < 4) continue;
      if (text.includes(" " + item.term + " ")) {
        const bonus = item.phrase ? 1.6 : 0;
        bump(item.entityId, (3.0 + bonus + item.term.length * 0.05) * item.weight, item.term);
      }
    }

    // 2. token distintivo ("orbital", "marketbobby", "cs50", "fabricart")
    if (!results.size) {
      for (const item of this.index) {
        for (const t of item.tokens) {
          if (!this.isDistinctive(t)) continue;
          if (rawTokens.includes(t)) bump(item.entityId, 2.6 * item.weight, item.term);
        }
      }
    }

    // 3. fuzzy sobre tokens distintivos (erro de digitação: "orbtial", "marketbob")
    if (!results.size) {
      for (const item of this.index) {
        for (const t of item.tokens) {
          if (!this.isDistinctive(t)) continue;
          for (const q of rawTokens) {
            if (q.length < 5 || EntityResolver.GENERIC.has(q)) continue;
            const sim = window.FuzzyMatcher.blended(q, t);
            if (sim >= 0.84) bump(item.entityId, 2.3 * sim * item.weight, item.term);
          }
        }
      }
    }

    if (!results.size) return null;
    const ranked = [...results.entries()].sort((a, b) => b[1].score - a[1].score);
    const [id, info] = ranked[0];
    if (info.score < 2.2) return null;
    return {
      entity: this.get(id),
      score: info.score,
      matchedTerm: info.term,
      alternatives: ranked.slice(1, 3).map(([k]) => this.get(k)),
    };
  }

  /** Resolve superlativo dentro de uma órbita: maior, menor, mais recente... */
  resolveSuperlative(superlative, orbitId) {
    if (orbitId === "experiencia" && superlative.id === "mais_demorado") {
      const declaredLongest = this.byOrbit(orbitId).filter((e) => e.meta?.longestTenure === true);
      if (declaredLongest.length === 1) return { entity: declaredLongest[0], ranking: declaredLongest };
    }

    const all = this.byOrbit(orbitId);
    const pool = all.filter((e) => e.meta && e.meta[superlative.field] != null);
    if (!pool.length) return null;

    // Não ranqueia usando apenas os registros que por acaso têm uma data ou
    // métrica: isso faria um item parecer mais recente/maior por falta de dados
    // nos demais. A exceção é uma distinção declarada explicitamente na base.
    if (superlative.id !== "mais_ambicioso" && pool.length !== all.length) return null;
    const sorted = pool.slice().sort((a, b) => {
      const av = a.meta[superlative.field];
      const bv = b.meta[superlative.field];
      if (av !== bv) return superlative.order === "desc" ? bv - av : av - bv;
      // desempate pela ordem cronológica declarada do satélite
      const ao = a.meta.ordem ?? 0;
      const bo = b.meta.ordem ?? 0;
      return superlative.order === "desc" ? bo - ao : ao - bo;
    });
    return { entity: sorted[0], ranking: sorted.slice(0, 3) };
  }
}

window.EntityResolver = EntityResolver;
