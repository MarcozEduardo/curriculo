/**
 * Tokenizer - normaliza, remove stopwords, expande sinônimos e gera n-gramas.
 */
class Tokenizer {
  constructor() {
    this.stopwords = new Set(["de", "do", "da", "em", "no", "na", "que", "se", "um", "uma", "para", "com"]);
    this.synonyms = {};
    this.synonymIndex = new Map(); // termo -> canônico
  }

  async init() {
    try {
      const [stopRes, synRes] = await Promise.all([
        fetch(window.RAG_URL("rag/dictionary/stopwords_pt.json")),
        fetch(window.RAG_URL("rag/dictionary/synonyms.json")),
      ]);
      const stopData = await stopRes.json();
      const synData = await synRes.json();
      if (Array.isArray(stopData)) this.stopwords = new Set(stopData);
      if (synData) {
        this.synonyms = synData;
        for (const [canon, list] of Object.entries(synData)) {
          this.synonymIndex.set(canon, canon);
          for (const term of list) this.synonymIndex.set(term, canon);
        }
      }
    } catch (e) {
      console.warn("[Tokenizer] dicionários não carregados, usando fallback mínimo.", e);
    }
  }

  /** Tokens crus (sem expansão), já normalizados. */
  raw(text) {
    const normalized = window.LeetNormalizer.normalize(text);
    return normalized
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  /** Tokens úteis: sem stopwords, com sinônimos canônicos adicionados. */
  tokenize(text, { expand = true } = {}) {
    const raw = this.raw(text);
    const base = raw.filter((w) => w.length > 1 && !this.stopwords.has(w));
    if (!expand) return base;

    const out = new Set(base);
    // expansão por token
    for (const t of base) {
      const canon = this.synonymIndex.get(t);
      if (canon) {
        out.add(canon);
        (this.synonyms[canon] || []).forEach((s) => s.split(" ").forEach((p) => out.add(p)));
      }
    }
    // expansão por expressão (bigramas: "home office", "inteligencia artificial")
    for (let i = 0; i < raw.length - 1; i++) {
      const bigram = raw[i] + " " + raw[i + 1];
      const canon = this.synonymIndex.get(bigram);
      if (canon) out.add(canon);
    }
    return Array.from(out);
  }

  ngrams(text, n = 2) {
    const raw = this.raw(text);
    const out = [];
    for (let i = 0; i <= raw.length - n; i++) out.push(raw.slice(i, i + n).join(" "));
    return out;
  }
}

window.Tokenizer = Tokenizer;
