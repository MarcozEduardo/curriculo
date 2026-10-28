/**
 * Humanizer - dá "voz" ao Bobby: aberturas por nível de confiança, uso do nome
 * do visitante, transições e placeholders ({nome}, {empresa}, {entidade}).
 * Toda escolha passa pela memória, evitando repetição próxima.
 */
class Humanizer {
  constructor(memory) {
    this.memory = memory;
    this.data = { aberturas: {}, transicoes: [], confianca_baixa: [], ambiguidade: [] };
  }

  async init() {
    // FIX BOLDING: carrega bold_words.json
    try {
      const r = await fetch(window.RAG_URL("rag/dictionary/bold_words.json"));
      const d = await r.json();
      this.boldWords = (d.words || []).sort((a, b) => b.length - a.length);
    } catch (e) { this.boldWords = []; }
    try {
      const res = await fetch(window.RAG_URL("rag/responses/humanizer.json"));
      this.data = await res.json();
    } catch (e) {
      console.warn("[Humanizer] humanizer.json indisponível.", e);
    }
  }

  fill(text, extra = {}) {
    if (!text) return "";
    const nome = this.memory.userName || "";
    const empresa = this.memory.userCompany ? `, da **${this.memory.userCompany}**` : "";
    return text
      .replace(/\{nome\}/g, nome)
      .replace(/\{empresa\}/g, extra.empresa !== undefined ? extra.empresa : empresa)
      .replace(/\{saudacao\}/g, this.memory.salutation())
      .replace(/\{entidade\}/g, extra.entidade || "")
      .replace(/\{sugestao\}/g, extra.sugestao || "")
      .replace(/\{opcoes\}/g, extra.opcoes || "")
      .replace(/\{resumo\}/g, extra.resumo || "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  opening(confidence) {
    const bucket = confidence >= 4 ? "alta_confianca" : "media_confianca";
    const list = this.data.aberturas?.[bucket] || [""];
    let opening = this.memory.pick(list, "abertura:" + bucket);

    // usa o nome do visitante em ~35% das respostas, sem soar repetitivo
    if (this.memory.userName && Math.random() < 0.35) {
      const nameList = this.data.aberturas?.com_nome || ["{nome}, "];
      const named = this.fill(this.memory.pick(nameList, "abertura:nome"));
      if (named) opening = named.replace(/\s*$/, " ") + opening;
    }
    return opening;
  }

  transition(force = false) {
    // Perguntas de continuação agora são geradas pelo DialogState, que as
    // rastreia. Só emite transição se for explicitamente forçado.
    const list = this.data.transicoes || [];
    if (!list.length || !force) return "";
    const t = this.memory.pick(list, "transicao");
    return t ? "\n\n" + t : "";
  }

  lowConfidence(sugestao) {
    const list = this.data.confianca_baixa || [];
    return this.fill(this.memory.pick(list, "baixa_confianca"), { sugestao });
  }

  ambiguity(opcoes) {
    const list = this.data.ambiguidade || [];
    return this.fill(this.memory.pick(list, "ambiguidade"), { opcoes });
  }

  // FIX PARAGRAFAR: ponto final + maiuscula -> linha em branco
  paragrafar(text) {
    if (!text) return text;
    if (text.includes("\n\n")) return text;
    const partes = text.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/);
    if (partes.length <= 1) return text;
    const out = [];
    let bloco = partes[0];
    for (let i = 1; i < partes.length; i++) {
      if (/^(Quer|Posso|Se quiser|Dá|Vale|Próximos|Outros|Mais|Ainda|Também)/i.test(partes[i])) {
        out.push(bloco);
        bloco = partes[i];
      } else if (bloco.length > 200) {
        out.push(bloco);
        bloco = partes[i];
      } else {
        bloco = bloco + " " + partes[i];
      }
    }
    out.push(bloco);
    return out.join("\n\n");
  }

  // FIX BOLDING: aplica ** em palavras-chave respeitando o que ja esta em **
  bolding(text) {
    if (!text || !this.boldWords || !this.boldWords.length) return text;
    const esc = (s) => s.replace(/[.*+?^${}()|[]\\]/g, "\\  compose(body, { confidence = 4, withTransition = false } = {}) {");
    const partes = String(text).split("**");
    for (let i = 0; i < partes.length; i += 2) {
      let bloco = partes[i];
      for (const w of this.boldWords) {
        const rx = new RegExp("(^|[^A-Za-zÀ-ÿ0-9])(" + esc(w) + ")(?=$|[^A-Za-zÀ-ÿ0-9])", "g");
        bloco = bloco.replace(rx, (m, sep, word) => sep + "**" + word + "**");
      }
      partes[i] = bloco;
    }
    return partes.join("**");
  }

  compose(body, { confidence = 4, withTransition = false } = {}) {
    const opening = this.opening(confidence);
    const transition = withTransition ? this.transition() : "";
    let final = (opening + body + transition).trim();
    // FIX LOWERCASE: depois de virgula/dois pontos, lowercase se nao for nome proprio
    final = final.replace(/([:,]\s+)([A-ZÀ-Ý])(?![a-zà-ÿ])/g, (m, sep, letra) => {
      const depois = final.slice(final.indexOf(m) + m.length, final.indexOf(m) + m.length + 12);
      if (/^(Marc|Edu|Bob|RAG|CSS|HTML|API|SQL|LAR|QA|TypeScript|JavaScript|Python|React|Embedding|CNC|Unyleya|Fabricart|Direct|Dama|Bella|Friends|Prepara|Socram|SOCRAM)/.test(letra + depois)) return m;
      return sep + letra.toLowerCase();
    });
    return this.paragrafar(this.bolding(final)); // FIX BOLDING
  }
}

window.Humanizer = Humanizer;
