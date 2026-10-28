/**
 * FuzzyMatcher - tolerância a erro de digitação.
 * Combina Levenshtein (com corte de banda), coeficiente de Dice por bigramas
 * e comparação de conjuntos de tokens. Cache interno para performance.
 */
class FuzzyMatcher {
  static _cache = new Map();

  static distance(s1, s2, maxDist = Infinity) {
    const a = s1 || "";
    const b = s2 || "";
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

    let prev = new Array(a.length + 1);
    let curr = new Array(a.length + 1);
    for (let j = 0; j <= a.length; j++) prev[j] = j;

    for (let i = 1; i <= b.length; i++) {
      curr[0] = i;
      let rowMin = curr[0];
      for (let j = 1; j <= a.length; j++) {
        const cost = b.charCodeAt(i - 1) === a.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j - 1] + cost, curr[j - 1] + 1, prev[j] + 1);
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > maxDist) return maxDist + 1;
      const tmp = prev;
      prev = curr;
      curr = tmp;
    }
    return prev[a.length];
  }

  /** Similaridade 0..1 por Levenshtein normalizado. */
  static similarity(s1, s2) {
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    const key = s1 + "\u0000" + s2;
    const cached = this._cache.get(key);
    if (cached !== undefined) return cached;

    const longer = s1.length >= s2.length ? s1 : s2;
    const shorter = s1.length >= s2.length ? s2 : s1;
    const dist = this.distance(longer, shorter);
    const score = (longer.length - dist) / longer.length;

    if (this._cache.size > 20000) this._cache.clear();
    this._cache.set(key, score);
    return score;
  }

  /** Coeficiente de Dice por bigramas — melhor para palavras longas trocadas. */
  static dice(s1, s2) {
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1 : 0;
    const grams = (s) => {
      const out = new Map();
      for (let i = 0; i < s.length - 1; i++) {
        const g = s.slice(i, i + 2);
        out.set(g, (out.get(g) || 0) + 1);
      }
      return out;
    };
    const g1 = grams(s1);
    const g2 = grams(s2);
    let hits = 0;
    for (const [g, c] of g1) hits += Math.min(c, g2.get(g) || 0);
    return (2 * hits) / (s1.length - 1 + s2.length - 1);
  }

  /** Mistura Levenshtein + Dice (robusto para nomes de projeto/empresa). */
  static blended(s1, s2) {
    return Math.max(this.similarity(s1, s2), this.dice(s1, s2) * 0.97);
  }

  /** Verdadeiro se as palavras forem "a mesma com erro de digitação". */
  static isTypo(word, target) {
    if (!word || !target) return false;
    if (word === target) return true;
    const len = Math.max(word.length, target.length);
    const tolerance = len <= 4 ? 0 : len <= 7 ? 1 : 2;
    if (tolerance === 0) return false;
    if (target.startsWith(word) && target.length - word.length <= 2) return true;
    return this.distance(word, target, tolerance) <= tolerance;
  }

  static findBestMatch(word, candidates, threshold = 0.78) {
    let best = null;
    let high = 0;
    for (const candidate of candidates) {
      const score = this.blended(word, candidate);
      if (score > high && score >= threshold) {
        high = score;
        best = candidate;
      }
    }
    return best ? { match: best, score: high } : null;
  }

  /** Similaridade entre frases por interseção de tokens com fuzzy. */
  static tokenSetSimilarity(tokensA, tokensB) {
    if (!tokensA.length || !tokensB.length) return 0;
    let hits = 0;
    for (const a of tokensA) {
      if (tokensB.includes(a)) {
        hits += 1;
        continue;
      }
      for (const b of tokensB) {
        if (this.isTypo(a, b)) {
          hits += 0.8;
          break;
        }
      }
    }
    return hits / Math.max(tokensA.length, tokensB.length);
  }
}

window.FuzzyMatcher = FuzzyMatcher;
