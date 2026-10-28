/**
 * PolarityEngine - peso do SIM, do NÃO e do TALVEZ.
 * Detecta perguntas fechadas ("ele sabe X?", "aceita Y?"), respostas soltas do
 * usuário (sim/não/talvez) e negação dentro da pergunta ("ele NÃO sabe React?").
 */
class PolarityEngine {
  constructor() {
    this.data = { prefixos: {}, respostas_soltas: {}, lexico: {} };
  }

  async init() {
    try {
      const res = await fetch(window.RAG_URL("rag/responses/polarity.json"));
      this.data = await res.json();
    } catch (e) {
      console.warn("[PolarityEngine] polarity.json indisponível.", e);
    }
  }

  /** O usuário respondeu apenas sim/não/talvez? */
  detectStandalone(normalizedText) {
    const t = normalizedText.trim();
    if (t.split(/\s+/).length > 3) return null;
    for (const [pol, words] of Object.entries(this.data.lexico || {})) {
      for (const w of words) {
        if (t === w || t.startsWith(w + " ")) return pol;
      }
    }
    return null;
  }

  /** É pergunta fechada (resposta sim/não)? */
  isClosedQuestion(normalizedText) {
    return /^(ele|o marcos|o marcao|voce|vc|tem|existe|da pra|aceita|sabe|pode|consegue|ja|e|esta|faz|teve|possui|trabalha|topa|conhece)\b/.test(
      normalizedText.trim()
    );
  }

  hasNegation(normalizedText) {
    return /\b(nao|nunca|jamais|nem)\b/.test(normalizedText);
  }

  /**
   * Define a polaridade da RESPOSTA para uma pergunta fechada, a partir da
   * faceta/entidade. Devolve 'sim' | 'nao' | 'talvez' | null.
   */
  resolveAnswerPolarity({ facet, orbit, normalizedText }) {
    const positives = [
      "sabe_programar", "vaga_afirmativa", "disponibilidade", "contratacao", "modelo_trabalho",
      "link", "qa", "certificacoes",
    ];
    const conditionals = ["experiencia_dev", "idiomas", "pontos_fracos", "nivel", "mudanca", "inacabados"];

    if (/\b(ingles|english)\b/.test(normalizedText)) return "talvez";
    if (/\b(ja trabalhou|carteira assinada|clt anterior|experiencia formal)\b/.test(normalizedText)) return "talvez";
    if (conditionals.includes(facet)) return "talvez";
    if (positives.includes(facet)) return "sim";
    if (facet === "vaga_afirmativa" || facet === "industria" || facet === "experiencia_dev") return "sim";
    return null;
  }

  prefix(polarity, memory) {
    const list = (this.data.prefixos || {})[polarity];
    if (!list || !list.length) return "";
    return memory ? memory.pick(list, "polarity:" + polarity) : list[0];
  }

  standaloneReply(polarity, memory) {
    const list = (this.data.respostas_soltas || {})[polarity] || [];
    if (!list.length) return null;
    return memory ? memory.pick(list, "polarity_solta:" + polarity) : list[0];
  }
}

window.PolarityEngine = PolarityEngine;
