/**
 * ProfanityFilter - moderação com tolerância a disfarce.
 * Reconhece: leetspeak (p0rr4), letras repetidas (poooorra), separadores
 * entre as letras (f.d.p, p o r r a), acentos e abreviações (pqp, vtnc).
 * A comparação usa o texto "colado" e o texto com letras repetidas reduzidas,
 * sempre com fronteira de palavra, para não acusar "computador" por "puta".
 */
class ProfanityFilter {
  constructor(list = []) {
    this.list = list;
    this.fallback = ["merda", "porra", "caralho", "puta", "fdp", "vtnc", "vsf", "tnc", "pqp", "idiota", "imbecil", "otario"];
  }

  async init() {
    if (this.list.length) return;
    try {
      const res = await fetch(window.RAG_URL("rag/dictionary/profanity_list.json"));
      if (!res.ok) throw new Error("HTTP " + res.status);
      this.list = await res.json();
    } catch (e) {
      this.list = this.fallback;
    }
  }

  /** "f . d . p" e "p o r r a" viram "fdp" e "porra". */
  despace(text) {
    return text.replace(/\b(?:[a-z][\s._\-*]+)+[a-z]\b/g, (m) => m.replace(/[\s._\-*]+/g, ""));
  }

  /** "poooorra" vira "pora": as duas pontas passam pelo mesmo colapso. */
  collapse(text) {
    return text.replace(/([a-z])\1+/g, "$1");
  }

  pattern(term) {
    const escaped = term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`);
  }

  check(rawText) {
    if (!rawText) return { isProfane: false };
    const L = window.LeetNormalizer;
    const light = L.light(rawText);
    const leet = L.normalize(rawText);
    const plain = [light, leet, this.despace(leet), this.despace(light)];
    const squeezed = plain.map((v) => this.collapse(v));
    const list = this.list.length ? this.list : this.fallback;

    for (const bad of list) {
      const term = L.deburr(bad);
      const termSqueezed = this.collapse(term);
      const termGlued = term.replace(/\s+/g, "");
      // Frase inteira digitada letra a letra ("p u t a q u e p a r i u") vira uma palavra só.
      const gluedHit = termGlued.length >= 8 && plain.slice(2).some((v) => this.pattern(termGlued).test(v));
      if (gluedHit || plain.some((v) => this.pattern(term).test(v)) || squeezed.some((v) => this.pattern(termSqueezed).test(v))) {
        return { isProfane: true, word: bad };
      }
    }
    return { isProfane: false };
  }
}

window.ProfanityFilter = ProfanityFilter;
