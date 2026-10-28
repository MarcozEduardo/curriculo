/**
 * OrbitRouter - decide em QUAL ÓRBITA a pergunta cai.
 * Carrega o banco mesh gerado (rag/mesh/questions/*.json), monta um índice
 * invertido de tokens e vota órbita + faceta. Aplica contexto pegajoso
 * (a órbita ativa ganha bônus) e detecta ambiguidade entre órbitas.
 */
class OrbitRouter {
  constructor(tokenizer) {
    this.tokenizer = tokenizer;
    this.orbits = [];
    this.byId = new Map();
    this.bank = []; // { orbit, facet, entity, tokens:[] }
    this.inverted = new Map(); // token -> Set(indices)
    this.vocab = [];
    this.totalQuestions = 0;
    this.orbitHeat = new Map();
  }

  async init() {
    let orbitsData = { orbits: [] };
    try {
      const orbitsRes = await fetch(window.RAG_URL("rag/mesh/orbits.json"));
      if (!orbitsRes.ok) throw new Error("HTTP " + orbitsRes.status);
      orbitsData = await orbitsRes.json();
    } catch (e) { console.warn("[OrbitRouter] orbits.json indisponível.", e); }
    this.orbits = orbitsData.orbits || [];
    this.orbits.forEach((o) => this.byId.set(o.id, o));

    let manifest = { orbits: this.orbits.map((o) => ({ file: `${o.id}.json` })) };
    try {
      const mRes = await fetch(window.RAG_URL("rag/mesh/questions/manifest.json"));
      if (!mRes.ok) throw new Error("HTTP " + mRes.status);
      manifest = await mRes.json();
    } catch (e) {
      console.warn("[OrbitRouter] manifest não encontrado, usando lista de órbitas.");
    }

    const files = await Promise.all(
      (manifest.orbits || []).map(async (m) => {
        try {
          const r = await fetch(window.RAG_URL(`rag/mesh/questions/${m.file}`));
          return await r.json();
        } catch (e) {
          return null;
        }
      })
    );

    for (const file of files) {
      if (!file || !file.entries) continue;
      for (const [facet, entity, tokenStr] of file.entries) {
        const tokens = tokenStr.split(" ");
        const idx = this.bank.length;
        this.bank.push({ orbit: file.orbit, facet, entity: entity || null, tokens });
        for (const t of tokens) {
          if (!this.inverted.has(t)) this.inverted.set(t, []);
          this.inverted.get(t).push(idx);
        }
      }
    }
    this.vocab = [...this.inverted.keys()];
    this.totalQuestions = this.bank.length;

    // --- Fura-bolha: tokens distintivos por órbita (para o termômetro) ---
    const tokenOrbitCount = new Map();
    for (const entry of this.bank) {
      for (const t of new Set(entry.tokens)) {
        if (!tokenOrbitCount.has(t)) tokenOrbitCount.set(t, new Set());
        tokenOrbitCount.get(t).add(entry.orbit);
      }
    }
    this.tokensByOrbit = new Map();
    for (const entry of this.bank) {
      if (!this.tokensByOrbit.has(entry.orbit)) this.tokensByOrbit.set(entry.orbit, new Set());
      const set = this.tokensByOrbit.get(entry.orbit);
      for (const t of entry.tokens) {
        if ((tokenOrbitCount.get(t) || new Set()).size <= 2) set.add(t);
      }
    }
    for (const orbit of this.orbits) {
      if (!this.tokensByOrbit.has(orbit.id)) this.tokensByOrbit.set(orbit.id, new Set());
      const set = this.tokensByOrbit.get(orbit.id);
      for (const k of orbit.keywords || []) {
        const nk = window.LeetNormalizer.deburr(k);
        set.add(nk);
        nk.split(/\s+/).forEach((w) => w.length > 1 && set.add(w));
      }
      for (const s of orbit.subjects || []) {
        const ns = window.LeetNormalizer.deburr(s);
        ns.split(/\s+/).forEach((w) => w.length > 1 && set.add(w));
      }
    }
  }

  getOrbit(id) {
    return this.byId.get(id) || null;
  }

  /**
   * Fura-bolha: chamado 1x por turno pelo ranker. Decai todas as temperaturas,
   * aquece a órbita ativa se a query a toca. Separado do route() porque o
   * route() é chamado 3x por turno (orbitConflict, retrieveFallback, principal)
   * e o decaimento múltiplo matava o heat.
   */
  tickHeat(queryTokens, activeOrbit) {
    const MAX_HEAT = 3;
    const expanded = this.expandTokens(queryTokens);
    // 1. Decai todas as temperaturas
    for (const [oid, h] of this.orbitHeat) this.orbitHeat.set(oid, Math.max(0, h - 1));
    // 2. Se a query toca a órbita ativa, aquece ela
    if (activeOrbit) {
      const orbTokens = this.tokensByOrbit.get(activeOrbit);
      if (orbTokens && orbTokens.size) {
        const touches = queryTokens.some((t) => orbTokens.has(t)) ||
                        expanded.some((e) => orbTokens.has(e.token));
        if (touches) {
          const cur = this.orbitHeat.get(activeOrbit) || 0;
          this.orbitHeat.set(activeOrbit, Math.min(MAX_HEAT, cur + 1));
        }
      }
    }
  }

  /** Expande tokens desconhecidos para o vocabulário mais próximo (typo-fix). */
  expandTokens(queryTokens) {
    const out = [];
    for (const t of queryTokens) {
      if (this.inverted.has(t)) {
        out.push({ token: t, weight: 1 });
        continue;
      }
      if (t.length < 4) continue;
      let best = null;
      let high = 0.82;
      for (const v of this.vocab) {
        if (Math.abs(v.length - t.length) > 2) continue;
        const sim = window.FuzzyMatcher.blended(t, v);
        if (sim > high) {
          high = sim;
          best = v;
        }
      }
      if (best) out.push({ token: best, weight: high * 0.9, corrected: t });
    }
    return out;
  }

  /**
   * @returns {{ranked:Array<{orbit,score,facet}>, ambiguous:boolean, corrections:Array}}
   */
  route(queryTokens, { activeOrbit = null, entityOrbit = null } = {}) {
    const expanded = this.expandTokens(queryTokens);
    const hits = new Map(); // bankIndex -> score

    for (const { token, weight } of expanded) {
      const list = this.inverted.get(token);
      if (!list) continue;
      // tokens muito frequentes pesam menos (IDF simplificado)
      const idf = Math.log(1 + this.bank.length / (list.length + 1));
      for (const idx of list) {
        hits.set(idx, (hits.get(idx) || 0) + weight * idf);
      }
    }

    // agrega por órbita usando o MELHOR casamento + densidade de acertos
    // (evita que uma órbita com muitas perguntas no banco vença por volume)
    const orbitBest = new Map();
    const orbitHits = new Map();
    const facetVotes = new Map();

    for (const [idx, raw] of hits) {
      const entry = this.bank[idx];
      const coverage = raw / Math.max(2, entry.tokens.length * 0.9);
      orbitBest.set(entry.orbit, Math.max(orbitBest.get(entry.orbit) || 0, coverage));
      orbitHits.set(entry.orbit, (orbitHits.get(entry.orbit) || 0) + 1);
      const fKey = entry.orbit + "|" + entry.facet + "|" + (entry.entity || "");
      facetVotes.set(fKey, Math.max(facetVotes.get(fKey) || 0, coverage));
    }

    const orbitScores = new Map();
    for (const [orbit, best] of orbitBest) {
      const density = Math.log2(1 + (orbitHits.get(orbit) || 0)) * 0.25;
      orbitScores.set(orbit, best * 2.2 + density);
    }

    // keywords diretas da órbita
    for (const orbit of this.orbits) {
      let kw = 0;
      for (const k of orbit.keywords || []) {
        if (queryTokens.includes(window.LeetNormalizer.deburr(k))) kw += 1.4;
      }
      if (kw) orbitScores.set(orbit.id, (orbitScores.get(orbit.id) || 0) + kw);
    }

    // prioridade declarada da órbita (desempate suave)
    for (const orbit of this.orbits) {
      if (orbitScores.has(orbit.id)) {
        orbitScores.set(orbit.id, orbitScores.get(orbit.id) * (1 + (orbit.priority || 5) / 100));
      }
    }

    // Fura-bolha: aplica bônus da temperatura (o tick é chamado 1x por turno pelo ranker)
    const HEAT_PER_UNIT = 0.5;
    for (const [oid, h] of this.orbitHeat) {
      if (h > 0 && orbitScores.has(oid)) {
        orbitScores.set(oid, orbitScores.get(oid) + h * HEAT_PER_UNIT);
      }
    }
    // Órbita da entidade citada mantém reforço forte
    if (entityOrbit) {
      orbitScores.set(entityOrbit, (orbitScores.get(entityOrbit) || 0) + 2.6);
    }

    const ranked = [...orbitScores.entries()]
      .map(([orbit, score]) => {
        let bestFacet = null;
        let bestFacetScore = 0;
        for (const [key, value] of facetVotes) {
          const [o, f, e] = key.split("|");
          if (o !== orbit) continue;
          if (value > bestFacetScore) {
            bestFacetScore = value;
            bestFacet = { facet: f, entity: e || null };
          }
        }
        return { orbit, score, facet: bestFacet?.facet || null, entity: bestFacet?.entity || null, facetScore: bestFacetScore };
      })
      .sort((a, b) => b.score - a.score);

    const ambiguous =
      ranked.length > 1 &&
      ranked[0].score > 0 &&
      ranked[0].score - ranked[1].score < (window.RAG_CONFIG.ambiguityDelta || 0.8) &&
      ranked[0].score < 4;

    return { ranked, ambiguous, corrections: expanded.filter((e) => e.corrected) };
  }
}

window.OrbitRouter = OrbitRouter;
