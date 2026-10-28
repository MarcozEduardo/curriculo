/**
 * DialogState - acompanhamento de aprofundamento da conversa.
 *
 * Responsabilidades:
 *  1. Carregar as árvores de aprofundamento (rag/mesh/deepening/*.json), em
 *     camadas 15 + 10 + 10 + 10 + 5 por tema. Cada nó tem pergunta, variações,
 *     resposta, rótulo curto e filhos (os sub-assuntos que o cercam).
 *  2. Reconhecer quando a pergunta do visitante corresponde a um nó.
 *  3. Montar a oferta de continuação ("Posso seguir por A, B ou C") a partir
 *     dos filhos do nó, das facetas do satélite ou das raízes da órbita, e
 *     guardar essa oferta como pendente na memória da sessão.
 *  4. Resolver a resposta curta do visitante à oferta pendente: número,
 *     ordinal, "sim", "não", "todos" ou o próprio rótulo da opção.
 *
 * Regra de ouro: o Bobby só oferece aprofundamento que existe na base.
 */
class DialogState {
  static SIGNAL = new Set(["voce"]);

  static GENERIC = new Set([
    "ele", "dele", "dela", "marcos", "marcao", "sobre", "qual", "quais", "como", "que", "isso",
    "esse", "essa", "este", "esta", "tem", "tambem", "ainda", "pode", "posso", "saber", "fala", "falar",
    "conta", "contar", "explica", "explicar", "detalhe", "detalhes", "mais", "algo", "alguma", "algum",
    "coisa", "bem", "ser", "esta", "faz", "fazer", "fez", "hoje", "quero", "queria", "gostaria", "diz",
    "dizer", "sim", "nao", "por", "favor",
  ]);

  constructor(memory, tokenizer) {
    this.memory = memory;
    this.tokenizer = tokenizer;
    this.nodes = new Map();
    this.children = new Map();
    this.byOrbit = new Map();
    this.vocab = new Set();
    this.tokenDf = new Map();
    this.templates = {};
    this.orbitLabels = {};
    this.total = 0;
  }

  async init() {
    const [tpl, manifest] = await Promise.all([
      fetch(window.RAG_URL("rag/responses/dialog_followups.json")).then((r) => (r.ok ? r.json() : ({}))).catch(() => ({})),
      fetch(window.RAG_URL("rag/mesh/deepening/manifest.json")).then((r) => (r.ok ? r.json() : ({ files: [] }))).catch(() => ({ files: [] })),
    ]);
    this.templates = tpl || {};
    const files = await Promise.all(
      (manifest.files || []).map((f) =>
        fetch(window.RAG_URL("rag/mesh/deepening/" + f)).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      )
    );
    for (const file of files) {
      if (!file || !Array.isArray(file.nodes)) continue;
      this.orbitLabels[file.orbit] = file.label || file.orbit;
      for (const node of file.nodes) this.addNode({ ...node, orbit: node.orbit || file.orbit });
    }
    // Perguntas extras de recrutador (layer 0): não entram nas árvores nem nas ofertas de raiz.
    try {
      const res = await fetch(window.RAG_URL("rag/mesh/faq_extra.json"));
      const faq = res.ok ? await res.json() : { items: [] };
      for (const item of faq.items || []) this.addNode({ ...item, layer: 0, parent: null });
    } catch (e) { /* faq opcional */ }
    this.total = this.nodes.size;
  }

  addNode(node) {
    const texts = [node.question, ...(node.variants || [])].filter(Boolean);
    node._raw = [];
    node._exp = new Set();
    for (const text of texts) {
      const raw = this.tokenizer.tokenize(text, { expand: false });
      node._raw.push(raw);
      this.tokenizer.tokenize(text).forEach((t) => node._exp.add(t));
      raw.forEach((t) => this.vocab.add(t));
    }
    const nodeTokenSet = new Set(node._raw.flat());
    nodeTokenSet.forEach((t) => this.tokenDf.set(t, (this.tokenDf.get(t) || 0) + 1));
    node._labelTokens = this.tokenizer.tokenize(node.label || node.question, { expand: false });
    node._keys = new Set([node.question, ...(node.variants || [])].map((t) => this.key(t)));
    this.nodes.set(node.id, node);
    if (node.parent) {
      if (!this.children.has(node.parent)) this.children.set(node.parent, []);
      this.children.get(node.parent).push(node.id);
    }
    if (!this.byOrbit.has(node.orbit)) this.byOrbit.set(node.orbit, []);
    this.byOrbit.get(node.orbit).push(node.id);
  }

  get(id) {
    return this.nodes.get(id) || null;
  }

  wasAsked(id) {
    return this.memory.askedNodes.has(id);
  }

  markAsked(id) {
    this.memory.askedNodes.add(id);
  }

  /* ----------------------- Correspondência de pergunta ----------------------- */

  /** Chave de comparação exata: sem acento, sem pontuação, espaços normalizados. */
  key(text) {
    return window.LeetNormalizer.light(String(text || "")).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  /** Nó cuja pergunta ou variação é idêntica ao texto (sem acento nem pontuação). */
  exactMatch(text, { orbit = null, entity = null } = {}) {
    const k = this.key(text);
    if (!k) return null;
    const found = [];
    for (const node of this.nodes.values()) if (node._keys.has(k)) found.push(node);
    if (!found.length) return null;
    found.sort((a, b) => Number(b.orbit === orbit) + Number(b.entity === entity) - (Number(a.orbit === orbit) + Number(a.entity === entity)));
    this.lastExact = true;
    return found[0];
  }

  contentTokens(tokens) {
    return tokens.filter((t) => t.length >= 2 && !DialogState.GENERIC.has(t));
  }

  /**
   * Procura um nó cuja pergunta corresponda ao que o visitante escreveu.
   * Exige cobertura nos dois sentidos para não sequestrar perguntas genéricas.
   */
  matchQuestion(rawTokens, expandedTokens, { orbit = null, entity = null, text = "" } = {}) {
    this.lastExact = false;

    // 1. Texto idêntico a uma pergunta ou variação autorada (inclui uma palavra só: "instagram").
    if (text) {
      const k = this.key(text);
      const exact = [];
      for (const node of this.nodes.values()) if (node._keys.has(k)) exact.push(node);
      if (exact.length) {
        exact.sort((a, b) => Number(b.orbit === orbit) + Number(b.entity === entity) - (Number(a.orbit === orbit) + Number(a.entity === entity)));
        this.lastExact = true;
        return exact[0];
      }
    }

    const content = this.contentTokens(rawTokens);
    if (content.length < 2) return null;
    const expanded = new Set(expandedTokens);
    let best = null;

    for (const node of this.nodes.values()) {
      if (node.entity && entity && node.entity !== entity) continue;
      for (const variant of node._raw) {
        const nodeTokens = this.contentTokens(variant);
        // Variação de uma palavra só vale por texto idêntico (exactMatch). Sem isso,
        // "ele sabe Excel?" casaria com qualquer nó cuja variação seja só "sabe".
        if (nodeTokens.length < 2) continue;

        let hitNode = 0;
        const matched = new Set();
        for (const t of nodeTokens) {
          // Pronome é sinal de QUEM está em jogo ("você" = o chat, "ele" = o Marcos):
          // só conta se o visitante escreveu, nunca por expansão de sinônimo.
          const viaSynonym = expanded.has(t) && !DialogState.SIGNAL.has(t);
          if (viaSynonym || rawTokens.includes(t) || rawTokens.some((u) => window.FuzzyMatcher.isTypo(u, t))) { hitNode += 1; matched.add(t); }
        }
        let hitUser = 0;
        for (const u of content) {
          if (node._exp.has(u) || nodeTokens.some((t) => window.FuzzyMatcher.isTypo(u, t))) hitUser += 1;
        }
        const coverNode = hitNode / nodeTokens.length;
        const coverUser = hitUser / content.length;
        // Exige boa cobertura nos DOIS sentidos: o nó precisa estar quase todo na
        // pergunta e a pergunta precisa estar quase toda no nó. Palavras que o
        // visitante usou e o nó não tem (ex.: "demorado", "desafio") derrubam o match.
        const strong = (coverNode >= 0.7 && coverUser >= 0.65) || (coverNode >= 1 && coverUser >= 0.5);
        if (!strong) continue;
        // Precisa casar ao menos uma palavra distintiva (rara entre os nós), não só palavras comuns.
        if (![...matched].some((t) => (this.tokenDf.get(t) || 0) <= 8)) continue;

        // Desempate: palavras que o visitante escreveu literalmente pesam mais que
        // as que só casam por sinônimo ("chat" também cobre "bobby" por expansão).
        const rawHits = nodeTokens.filter((t) => rawTokens.includes(t)).length;
        let score = coverNode * 0.55 + coverUser * 0.45 + 0.15 * (rawHits / nodeTokens.length);
        if (orbit && node.orbit === orbit) score += 0.05;
        if (entity && node.entity === entity) score += 0.1;
        if (!best || score > best.score) best = { node, score, coverNode, coverUser };
      }
    }
    return best && best.score >= 0.82 ? best.node : null;
  }

  /* ------------------------------ Ofertas ------------------------------ */

  facetLabel(facet) {
    const labels = this.templates.facet_labels || {};
    return labels[facet] || facet.replace(/_/g, " ");
  }

  nodeOption(node) {
    return {
      kind: "node",
      id: node.id,
      label: node.label || node.question,
      aliases: Array.from(new Set([...(node._labelTokens || []), ...(node._raw[0] || [])])),
      orbit: node.orbit,
      entity: node.entity || null,
    };
  }

  facetOption(entity, facet) {
    const label = this.facetLabel(facet);
    return {
      kind: "facet",
      id: facet,
      label,
      aliases: Array.from(new Set([...this.tokenizer.tokenize(label, { expand: false }), facet])),
      orbit: entity.orbit,
      entity: entity.id,
      facet,
    };
  }

  orbitOption(orbitId, label, aliases = []) {
    return {
      kind: "orbit",
      id: orbitId,
      label,
      aliases: Array.from(new Set([...this.tokenizer.tokenize(label, { expand: false }), ...aliases])),
      orbit: orbitId,
    };
  }

  mainMenuOffer() {
    const options = [
      this.orbitOption("projetos", "projetos", ["projeto", "portfolio", "jogos", "games"]),
      this.orbitOption("skills", "habilidades e stack", ["stack", "skills", "tecnologias"]),
      this.orbitOption("experiencia", "experiência", ["carreira", "emprego", "trabalho"]),
      this.orbitOption("recrutamento", "condições de contratação", ["condicoes", "contratacao", "vaga"]),
    ];
    return { options, text: this.render(options), silent: true };
  }

  unaskedRoots(orbitId, exclude = new Set()) {
    const ids = this.byOrbit.get(orbitId) || [];
    const roots = ids.map((id) => this.nodes.get(id)).filter((n) => n.layer === 1 && !this.wasAsked(n.id) && !exclude.has(n.id));
    if (!roots.length) return [];
    const cursor = this.memory.offerCursor[orbitId] || 0;
    const rotated = roots.slice(cursor % roots.length).concat(roots.slice(0, cursor % roots.length));
    this.memory.offerCursor[orbitId] = cursor + 3;
    return rotated;
  }

  /**
   * Monta a continuação possível depois de uma resposta.
   * Prioridade: filhos do nó > facetas restantes do satélite > nós ligados ao
   * satélite > raízes da órbita. Só oferece o que existe.
   */
  buildOffer({ node = null, orbitId = null, entity = null, facet = null } = {}) {
    const options = [];
    const used = new Set();
    const pushNode = (n) => {
      if (!n || used.has("node:" + n.id) || this.wasAsked(n.id) || options.length >= 3) return;
      used.add("node:" + n.id);
      options.push(this.nodeOption(n));
    };

    if (node) {
      (this.children.get(node.id) || []).map((id) => this.nodes.get(id)).forEach(pushNode);
    }

    if (options.length < 2 && entity) {
      const skip = new Set(["resumo", "default", facet]);
      const available = Object.keys(entity.facets || {}).filter(
        (f) => !skip.has(f) && !this.memory.facetAnswered(entity.id, f)
      );
      for (const f of available) {
        if (options.length >= 3) break;
        options.push(this.facetOption(entity, f));
      }
      if (options.length < 2) {
        (this.byOrbit.get(entity.orbit) || [])
          .map((id) => this.nodes.get(id))
          .filter((n) => n.entity === entity.id)
          .forEach(pushNode);
      }
    }

    const targetOrbit = orbitId || node?.orbit || entity?.orbit || null;
    if (options.length < 2 && targetOrbit) {
      const exclude = new Set(node ? [node.id] : []);
      const justAnswered = facet || null;
      this.unaskedRoots(targetOrbit, exclude)
        .filter((n) => !justAnswered || n.facet !== justAnswered)
        .forEach(pushNode);
    }

    if (!options.length) return null;
    const trimmed = options.slice(0, 3);
    return { options: trimmed, text: this.render(trimmed) };
  }

  render(options) {
    const labels = options.map((o) => `**${o.label}**`);
    if (labels.length === 1) {
      const single = this.templates.single_offer_templates || ["Quer que eu detalhe {opcao}?"];
      return this.memory.pick(single, "offer:single").replace("{opcao}", labels[0]);
    }
    const joined = labels.length === 2 ? `${labels[0]} ou ${labels[1]}` : `${labels.slice(0, -1).join(", ")} ou ${labels[labels.length - 1]}`;
    const many = this.templates.offer_templates || ["Posso continuar por {opcoes}."];
    return this.memory.pick(many, "offer:many").replace("{opcoes}", joined);
  }

  setPending(offer) {
    this.memory.pendingOffer = offer && offer.options && offer.options.length ? offer : null;
    this.memory.pendingTurn = this.memory.turn;
  }

  clearPending() {
    this.memory.pendingOffer = null;
  }

  pendingLabels() {
    const p = this.memory.pendingOffer;
    if (!p) return "";
    const labels = p.options.map((o) => `**${o.label}**`);
    return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} ou ${labels[labels.length - 1]}`;
  }

  /* ------------------------- Resolução da resposta ------------------------- */

  /**
   * @returns {null | {type:'option', option} | {type:'reask'} | {type:'decline'}}
   */
  resolvePending(normalizedText, rawTokens) {
    const pending = this.memory.pendingOffer;
    if (!pending || !pending.options || !pending.options.length) return null;
    const text = String(normalizedText || "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (!text || rawTokens.length > 9) return null;
    // Uma pergunta completa ("qual projeto foi o mais demorado?") não é resposta à
    // oferta: tem interrogativo ou mais de 4 tokens de conteúdo.
    const looksLikeQuestion = /^(qual|quais|como|quando|onde|quem|quanto|quantos|quantas|por que|porque|o que)\b/.test(text) || /\?$/.test(String(normalizedText || "").trim());
    if (looksLikeQuestion && rawTokens.length >= 3) return null;
    const opts = pending.options;

    const numeric = text.match(/^(?:a |o |op[cç]ao |opcao |numero |n )?([1-3])\b/);
    if (numeric) {
      const option = opts[Number(numeric[1]) - 1];
      return option ? { type: "option", option } : null;
    }
    const ordinal = text.match(/\b(primeir|segund|terceir|ultim)/);
    if (ordinal && rawTokens.length <= 4) {
      const idx = { primeir: 0, segund: 1, terceir: 2, ultim: opts.length - 1 }[ordinal[1]];
      const option = opts[idx];
      return option ? { type: "option", option } : null;
    }

    if (rawTokens.length <= 4) {
      if (/^(todos|todas|ambos|ambas|os dois|as duas|os tres|as tres|pode ser os dois)\s*[.,!]?\s*$/.test(text)) { // FIX TUDO v3: removido "tudo" // FIX TUDO: exige fim de linha
        return { type: "option", option: opts[0], remaining: opts.slice(1) };
      }
      if (/^(sim|pode|claro|quero|bora|vamos|ok|okay|manda|isso|positivo|com certeza|por favor|pode ser|beleza|blz|vai|uhum|aham|s|yes|show|top|continua|continue|segue|prossiga|pode continuar)\b/.test(text)) {
        return opts.length === 1 ? { type: "option", option: opts[0] } : { type: "reask" };
      }
      if (/^(nao|não|nope|deixa|agora nao|nenhum|nenhuma|outro assunto|depois|nem|chega|ja basta)\b/.test(text)) {
        return { type: "decline" };
      }
    }

    const content = this.contentTokens(rawTokens);
    const scored = opts.map((option) => {
      const label = window.LeetNormalizer.light(option.label).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      if (text === label || text.includes(label) || (text.length >= 3 && label.includes(text))) return { option, score: 1 };
      if (!content.length) return { option, score: 0 };
      const aliases = new Set((option.aliases || []).map((a) => window.LeetNormalizer.light(a)));
      let hit = 0;
      for (const t of content) {
        if (aliases.has(t) || [...aliases].some((a) => a.length >= 4 && window.FuzzyMatcher.isTypo(t, a))) hit += 1;
      }
      return { option, score: hit / content.length };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const second = scored[1];
    if (best && best.score >= 0.5 && (!second || second.score < 0.5 || best.score - second.score >= 0.2)) {
      return { type: "option", option: best.option };
    }
    return null;
  }

  stats() {
    return { nos: this.total, orbitas: this.byOrbit.size };
  }
}

window.DialogState = DialogState;
