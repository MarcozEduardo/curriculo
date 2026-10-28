/**
 * SimilarityCalculator - relevância entre consulta e documento (BM25 simplificado
 * com bônus de keyword e tolerância fuzzy). Usado no fallback de knowledge base.
 */
class SimilarityCalculator {
  static WEIGHTS = { keyword: 5.0, keywordFuzzy: 3.2, content: 1.2, contentCap: 4.0, title: 2.0 };

  static score(queryTokens, docTokens, docKeywords = [], titleTokens = []) {
    if (!queryTokens.length) return 0;
    const W = this.WEIGHTS;
    const keywords = docKeywords.map((k) => window.LeetNormalizer.deburr(k));
    let score = 0;

    for (const q of queryTokens) {
      if (keywords.includes(q)) {
        score += W.keyword;
      } else {
        const best = window.FuzzyMatcher.findBestMatch(q, keywords, 0.82);
        if (best) score += W.keywordFuzzy * best.score;
      }

      const hits = docTokens.filter((d) => d === q).length;
      if (hits > 0) score += Math.min(hits * W.content, W.contentCap);

      if (titleTokens.includes(q)) score += W.title;
    }

    // normaliza levemente pelo tamanho da consulta (evita premiar frase longa)
    return score / Math.max(1, Math.log2(queryTokens.length + 2) / 1.6);
  }
}

window.SimilarityCalculator = SimilarityCalculator;
