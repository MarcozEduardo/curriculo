/**
 * FacetDetector - descobre O QUE está sendo perguntado (faceta) e se há
 * superlativo ("mais recente", "o maior", "o mais rápido").
 * Dep: rag/mesh/facets.json, FuzzyMatcher, Tokenizer.
 */
class FacetDetector {
  constructor(tokenizer) {
    this.tokenizer = tokenizer;
    this.facets = [];
    this.superlatives = [];
  }

  async init() {
    let data = {};
    try {
      const res = await fetch(window.RAG_URL("rag/mesh/facets.json"));
      if (!res.ok) throw new Error("HTTP " + res.status);
      data = await res.json();
    } catch (e) { console.warn("[FacetDetector] facets.json indisponível, sem facetas.", e); }
    this.facets = (data.facets || []).map((f) => ({
      ...f,
      compiled: (f.regex || []).map((r) => new RegExp(r, "i")),
      triggerTokens: (f.triggers || []).map((t) => this.tokenizer.tokenize(t, { expand: false })),
      keyTokens: Array.from(
        new Set(
          (f.triggers || [])
            .flatMap((t) => window.LeetNormalizer.light(t).split(/\s+/))
            .filter((w) => w.length >= 5 || ["pcd", "tea", "laudo", "cota"].includes(w))
        )
      ),
    }));
    // Palavras que aparecem em várias facetas (ou são genéricas do domínio)
    // não podem identificar faceta sozinhas — senão "quais os jogos?" viraria
    // "tecnologias" só por causa da palavra "quais".
    const GENERIC_KEY = new Set([
      "quais", "qual", "quanto", "quantos", "quantas", "projeto", "projetos", "jogos", "jogo",
      "trabalho", "empresa", "marcos", "marcao", "sobre", "dele", "ele", "voce", "coisa",
      "fazer", "feito", "usou", "tem", "pode", "poderia", "melhor", "algum", "alguma", "construiu", "construir", "criou", "criar", "construido",
      "quero", "queria", "gostaria", "preciso", "saber", "conhecer", "conhece",
      "fala", "falar", "fale", "conta", "contar", "diz", "dizer", "mostra", "mostrar",
      "explica", "explicar", "ver", "manda", "mandar", "traz", "apresentar", "apresenta",
      "candidato", "profissional", "dev", "pessoa", "perfil",
      "assistente", "autor", "criador", "bot", "bobby", "chat", "site", "sistema",
      "pergunta", "duvida", "informacao", "detalhe", "detalhes",
    ]);
    const df = new Map();
    for (const f of this.facets) {
      for (const t of new Set(f.keyTokens)) df.set(t, (df.get(t) || 0) + 1);
    }
    for (const f of this.facets) {
      f.keyTokens = f.keyTokens.filter((t) => !GENERIC_KEY.has(t) && (df.get(t) || 0) === 1);
    }

    this.superlatives = data.superlatives || [];
    this.allKeyTokens = new Set(this.facets.flatMap((f) => f.keyTokens));
  }

  /** @returns {{facet:string|null, score:number, ranked:Array}} */
  detect(normalizedText, queryTokens) {
    const ranked = [];

    for (const facet of this.facets) {
      let score = 0;

      for (const rx of facet.compiled) {
        if (rx.test(normalizedText)) score += 2.4;
      }

      for (const trigger of facet.triggers || []) {
        if (normalizedText.includes(trigger)) {
          score += 3.0;
          break;
        }
      }

      if (score === 0) {
        let best = 0;
        for (const tTokens of facet.triggerTokens) {
          const sim = window.FuzzyMatcher.tokenSetSimilarity(tTokens, queryTokens);
          if (sim > best) best = sim;
        }
        if (best >= 0.68) score += best * 2.6;

        // tolerância a erro de digitação em palavra-chave isolada
        // ("tecnolgias" → "tecnologias", "pretenssao" → "pretensao")
        if (score === 0) {
          for (const q of queryTokens) {
            if (q.length < 5) continue;
            for (const k of facet.keyTokens) {
              if (Math.abs(k.length - q.length) > 3) continue;
              const sim = window.FuzzyMatcher.blended(q, k);
              if (sim >= 0.85) {
                score += 2.2 * sim;
                break;
              }
            }
            if (score > 0) break;
          }
        }
      }

      if (score > 0) {
        ranked.push({
          id: facet.id,
          score: score * (facet.weight / 3),
          label: facet.label,
          home: facet.home_orbit || null,
        });
      }
    }

    ranked.sort((a, b) => b.score - a.score);
    return { facet: ranked[0]?.id || null, score: ranked[0]?.score || 0, home: ranked[0]?.home || null, ranked };
  }

  detectSuperlative(normalizedText, context = {}) {
    const projectContext = context.activeOrbit === "projetos" || context.activeOrbit === "experiencia";
    for (const sup of this.superlatives) {
      for (const trigger of sup.triggers) {
        if (!normalizedText.includes(trigger)) continue;

        // "maior desafio" é uma pergunta sobre a faceta desafio, não sobre
        // o tamanho de um projeto. Só interpreta "maior" como comparação
        // entre itens quando há contexto explícito de portfólio/projetos.
        if (sup.id === "maior" && /\b(desafio|dificuldade|problema|bug|obstaculo)\b/.test(normalizedText)) {
          continue;
        }
        if (sup.id === "maior" && !projectContext && !/\b(projeto|projetos|portfolio|jogo|jogos|game|games|sistema|sistemas|ferramenta|ferramentas)\b/.test(normalizedText)) {
          continue;
        }
        // "primeiro computador", "primeiro emprego" são fatos da história, não comparação.
        if ((sup.id === "mais_antigo" || sup.id === "mais_recente") && !projectContext && !/\b(projeto|projetos|portfolio|jogo|jogos|game|games|sistema|sistemas|ferramenta|ferramentas|trabalho|empresa|emprego|experiencia)\b/.test(normalizedText)) {
          continue;
        }
        return sup;
      }
    }
    // tolerância a erro: "mais rapdio", "mas recente"
    const words = normalizedText.split(/\s+/);
    for (const sup of this.superlatives) {
      for (const trigger of sup.triggers) {
        const tWords = trigger.split(" ");
        if (tWords.length > 1) continue;
        if (words.some((w) => window.FuzzyMatcher.isTypo(w, trigger))) return sup;
      }
    }
    return null;
  }
}

window.FacetDetector = FacetDetector;
