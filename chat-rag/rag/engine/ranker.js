/**
 * RagRanker - orquestrador do motor mesh.
 *
 * Pipeline:
 *  normalização → moderação → intenções sociais/identidade → correção do usuário
 *  → resolução de entidade → detecção de faceta/superlativo → roteamento de órbita
 *  → composição da resposta (entidade > órbita > knowledge base > resposta sagrada)
 *  → humanização, polaridade, anti-repetição e citação de fonte.
 */
class RagRanker {
  constructor() {
    this.tokenizer = new window.Tokenizer();
    this.profanity = new window.ProfanityFilter();
    this.memory = new window.SessionMemory();
    this.facets = new window.FacetDetector(this.tokenizer);
    this.entities = new window.EntityResolver();
    this.router = new window.OrbitRouter(this.tokenizer);
    this.polarity = new window.PolarityEngine();
    this.humanizer = new window.Humanizer(this.memory);
    this.inputGuard = new window.InputGuard();
    this.dialog = new window.DialogState(this.memory, this.tokenizer);
    this.reaction = new window.ReactionEngine(this.memory, this.tokenizer, this.dialog);
    this.responses = {};
    this.knowledge = [];
    this.topicChoices = [];
    this.englishKnown = new Set();
    this.passages = [];
    this.passageDf = new Map();
    this.passageVocab = [];
    this.isReady = false;
  }

  /* ------------------------------- Boot -------------------------------- */

  /**
   * Carrega um JSON com fallback. Cada arquivo falha sozinho: se um 404 ou a
   * rede cair em um deles, o motor ainda sobe com o que conseguiu (o visitor
   * nunca fica com "carregando inteligência..." para sempre).
   */
  async loadJson(path, fallback) {
    try {
      const res = await fetch(window.RAG_URL(path));
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("[RagRanker] fallback para", path, e.message || e);
      return fallback;
    }
  }

  async init() {
    const files = [
      "greeting", "smalltalk", "user_identity", "unknown_sacred", "off_topic",
      "repeat_detection", "profanity_response", "correction", "input_guard", "dialog_followups",
    ];

    await this.tokenizer.init();

    await Promise.all([
      this.profanity.init(),
      this.facets.init(),
      this.entities.init(),
      this.router.init(),
      this.polarity.init(),
      this.humanizer.init(),
      this.inputGuard.init(),
      this.dialog.init(),
      this.reaction.init(),
      (async () => {
        const data = await this.loadJson("rag/dictionary/english_terms.json", { function_words: [] });
        this.englishKnown = new Set((data.function_words || []).map((w) => String(w).toLowerCase()));
      })(),
      (async () => {
        const data = await this.loadJson("rag/mesh/topic_choices.json", { choices: [] });
        this.topicChoices = Array.isArray(data.choices) ? data.choices : [];
      })(),
      (async () => {
        const d = await this.loadJson('rag/mesh/dominio.json', { dominios: [] });
        this.dominios = d.dominios || [];
      })(),
      (async () => {
        const kb = await this.loadJson("data/knowledge_base.json", { chunks: [] });
        this.knowledge = (kb.chunks || []).map((c) => ({
          ...c,
          _tokens: this.tokenizer.tokenize(c.content + " " + c.title),
          _title: this.tokenizer.tokenize(c.title),
        }));
      })(),
      (async () => {
        const t = await this.loadJson('rag/mesh/torch.json', { intents: [], torch_words: [], fora_words: [] });
          this.torchData = t;
        })(),
        (async () => {
          const pp = await this.loadJson('rag/mesh/palavras-projetos.json', {});
          this.palavrasProjetos = pp;
        })(), // FIX PROJETOS-CLASS
      ...files.map(async (name) => {
        this.responses[name] = await this.loadJson(`rag/responses/${name}.json`, {});
      }),
    ]);

    this.buildPassages();
    this.isReady = true;
    return this.stats();
  }

  stats() {
    return {
      versao: window.RAG_CONFIG.version,
      orbitas: this.router.orbits.length,
      variacoesDePergunta: this.router.totalQuestions,
      entidades: this.entities.entities.length,
      facetas: this.facets.facets.length,
      chunks: this.knowledge.length,
      aprofundamentos: this.dialog.total,
    };
  }

  /* ----------------------------- Utilidades ---------------------------- */

  pick(list, key) {
    return this.memory.pick(list, key);
  }

  summarize(text) {
    // FIX J: limpa lead humanizado antes de resumir (evita {resumo} = "Claro.")
    let plain = String(text).replace(/\*\*/g, "");
    plain = plain.replace(/^(Claro|Boa pergunta|Boa|Show|Beleza|Perfeito|Bacana|Posso detalhar|Tudo bem|Tranquilo|Ok|Fechado|Que bom|Certo|Entendi|Olha|Bom|Veja)\s*[.,!]\s*/i, "");
    const first = plain.split(/\n|(?<=\.)\s/)[0];
    return first.length > 180 ? first.slice(0, 177) + "..." : first;
  }

  /**
   * SALARY GUARD — política de privacidade de remuneração.
   * Nenhuma resposta pode conter valor, faixa ou moeda. Se algum conteúdo
   * trouxer número monetário, ele é substituído pela resposta institucional.
   * A trava é aplicada em TODA saída de `answer()`, sem exceção.
   */
  enforceSalaryPolicy(text) {
    if (!text) return text;

    // Contextos legítimos que contêm número e NÃO são remuneração
    // (lei, CID, norma, ano, telefone, versão).
    const legal = /\b(lei|decreto|norma|portaria|cid|nbr|artigo|inciso|n[ºo°]\.?)\s*(federal\s*)?n?[ºo°]?\.?\s*[\d.]+/i;
    const sanitized = text.replace(legal, " ").replace(/\(\d{2}\)\s*\d{4,5}-?\d{4}/g, " ");

    // Moeda explícita (real ou dólar) ou valor seguido de "reais"
    const currency = /r\$\s*\d|\$\s*\d[\d.,]*|\b\d[\d.,]*\s*reais\b|\b\d[\d.,]*\s*(eur|usd)\b/i;
    // Vocabulário de remuneração em PT e EN
    const salaryWord = /(sal[áa]ri\w*|pretens\w*|remunera\w*|ganh\w*|receb\w*|pag\w*|faixa|hora|m[êe]s|mensa\w*|cobr\w*|cust\w*|valor|salary|wage|compensat\w*|pay\b|earn\w*)/i;
    // Número grande (milhar), "X mil", "3k", "3.5k"
    const bigNumber = /\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b|\b\d+(\.\d+)?\s*(mil|k)\b/i;

    const hasCurrency = currency.test(sanitized);
    const hasSalaryNumber = bigNumber.test(sanitized) && salaryWord.test(sanitized);

    if (!hasCurrency && !hasSalaryNumber) return text;
    const safeList = [
      "Sobre remuneração, a orientação é objetiva: **a combinar**, compatível com a faixa praticada para a posição. O Marcos prefere alinhar esse ponto diretamente com a empresa, avaliando escopo, benefícios e modelo de trabalho, o contato é **(61) 98222-7804** ou **marcos.eduardo@myyahoo.com**.",
      "Valores eu não informo por aqui. A pretensão dele é **compatível com o mercado para a função**, com abertura total para negociar conforme o pacote. Esse alinhamento ele faz diretamente: **(61) 98222-7804**.",
      "Essa informação não fica no assistente. A remuneração é **alinhada caso a caso**, conforme a vaga, o nível e os benefícios. O que posso adiantar é que ele é flexível e prioriza o encaixe técnico e a chance de crescer na equipe.",
    ];
    console.warn("[RagRanker] salary guard acionado, valor monetário removido da resposta.");
    return this.pick(safeList, "salary_guard");
  }

  result(text, meta = {}) {
    const safe = this.enforceSalaryPolicy(String(text).trim());
    return Object.assign(
      { text: safe, source: "Bobby", orbit: null, facet: null, entity: null, confidence: 0 },
      meta
    );
  }

  /* ------------------------------ Resposta ----------------------------- */

  /**
   * Ponto de entrada. Garante a regra do projeto: TODA resposta leva para algum
   * lugar (oferta de continuação rastreada), exceto despedida e reinício.
   */
  answer(userPrompt) {
    this.memory.turn = (this.memory.turn || 0) + 1;
    const res = this._answer(userPrompt);
    // FIX SAUDACAO-AUTO: se for 1o turno e a msg NAO tem saudacao, prefixa pelo horario
    if (this.memory.turn === 1 && res && res.text && !res.action && res.orbit !== "smalltalk") {
      const norm1 = window.LeetNormalizer.normalize(String(userPrompt || ""));
      const jaSaudou = /^(oi|ola|oie|opa|eai|e ai|fala|salve|hey|hi|hello|bom dia|boa tarde|boa noite|tudo bem|tudo bom)\b/.test(norm1);
      if (!jaSaudou) {
        const h = new Date().getHours();
        const saud = h < 12 ? "Opa, bom dia! " : h < 18 ? "Opa, boa tarde! " : "Opa, boa noite! ";
        res.text = saud + res.text;
      }
    }
    if (!this.isReady) return res;
    this.ensureForwardPath(res);
    // Pergunta em inglês: entendo, mas a base está em português. Avisa uma única vez.
    if (res && !res.action && !this.memory.englishNoted && this.looksEnglish(userPrompt)) {
      res.text = "Eu respondo em português, que é o idioma da minha base.\n\n" + res.text;
      this.memory.englishNoted = true;
    }
    if (res && res.text && res.orbit !== "moderacao" && res.facet !== "repeat") {
      this.memory.lastReply = { text: res.text, orbit: res.orbit };
    }
    return res;
  }

  looksEnglish(text) {
    const words = this.reaction.words(text);
    if (words.length < 3) return false;
    const hits = words.filter((w) => this.englishKnown.has(w)).length;
    return hits >= Math.ceil(words.length * 0.5);
  }

  _answer(userPrompt) {
    if (!this.isReady) return this.result("Carregando a base de conhecimento, só um instante...", { source: "Sistema" });

    const raw = String(userPrompt || "").trim();
    if (!raw) return this.result("Pode mandar a pergunta que eu respondo 🙂", { source: "Bobby" });

    /* 0. Higiene da entrada ------------------------------------------- */
    const guard = this.inputGuard.check(raw);
    if (!guard.ok) {
      return this.result(this.pick(guard.variations, "guard:" + guard.reason), {
        source: "Filtro de entrada",
        orbit: "moderacao",
        facet: guard.reason,
        confidence: 5,
      });
    }

    const light = window.LeetNormalizer.light(raw);
    const norm = window.LeetNormalizer.normalize(raw);
    let tokens = this.tokenizer.tokenize(raw);

    // FIX FURA-BOLHA: tick do heat 1x por turno (route é chamado 3x e matava o heat)
    if (this.router && this.router.tickHeat) {
      this.router.tickHeat(tokens, this.memory.activeOrbit);
    }

    // FIX ESPERA-ALVO: se eu perguntei o alvo e o user responde com uma âncora,
    // respondo direto sem passar pela dúvida de novo.
    if (this.memory.aguardandoAlvo && this.palavrasProjetos) {
      const rawLev = window.LeetNormalizer.light(raw).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const ancs = this.palavrasProjetos.ancoras_outras || [];
      let ancAchada = null;
      for (const a of ancs) { if (rawLev.includes(a)) { ancAchada = a; break; } }
      if (ancAchada) {
        this.memory.aguardandoAlvo = false;
        const ent = this.entities.get(ancAchada) || this.entities.entities.find((e) => (e.aliases || []).includes(ancAchada) || e.id === ancAchada);
        const orbitAlvo = ent ? this.router.getOrbit(ent.orbit) : this.router.orbits.find((o) => (o.subjects || []).includes(ancAchada) || (o.keywords || []).includes(ancAchada));
        if (orbitAlvo) {
          const composedE = ent
            ? this.composeAnswer({ orbit: orbitAlvo, entity: ent, facet: "resumo" })
            : this.composeAnswer({ orbit: orbitAlvo, entity: null, facet: "default" });
          if (composedE && composedE.body) {
            const offerE = this.dialog.buildOffer({ orbitId: orbitAlvo.id, entity: ent, facet: "resumo" });
            this.dialog.setPending(offerE);
            this.memory.record(raw, { orbit: orbitAlvo.id, entity: ent ? ent.id : null, facet: "resumo", intentId: "espera_alvo:" + ancAchada, summary: this.summarize(composedE.body) });
            return this.result(composedE.body + (offerE ? "\n\n" + offerE.text : ""), { source: composedE.source, orbit: orbitAlvo.id, entity: ent ? ent.id : null, facet: "resumo", confidence: 5 });
          }
        }
      } else {
        const variacoes = [
          "Ainda não peguei o alvo. Sobre o quê, exatamente? Um projeto, uma tecnologia, uma empresa, ou o perfil dele?",
          "Continuo sem saber sobre o que você quer. Me dá uma pista: um nome, uma tecnologia, uma empresa?",
          "Não identifiquei o alvo. Pode ser mais específico? Um projeto, uma empresa, uma linguagem?",
          "Ainda não tenho o alvo. Sobre o que exatamente?"
        ];
        const txt = this.pick(variacoes, "espera_duvida");
        const offerD = this.dialog.mainMenuOffer();
        this.dialog.setPending(offerD);
        return this.result(txt + "\n\n" + offerD.text, { source: "Assistente Bobby", orbit: "smalltalk", facet: "duvida_projeto", confidence: 5 });
      }
    }

    /* 1. Moderação ----------------------------------------------------- */
    const prof = this.profanity.check(raw);
    if (prof.isProfane) return this.handleProfanity();
    if (this.reaction.detectHostile(raw)) return this.handleHostile(raw);

    /* 2. Identidade do visitante --------------------------------------- */
    const previousName = this.memory.userName;
    if (/(?:meu nome (?:é|e)|me chamo|pode me chamar de|me chamam de|sou chamad[oa] de)[\s.…!?]*$/i.test(light)) {
        this.memory.record(raw, { orbit: "identidade_visitante", facet: "nome_incompleto", intentId: "nome_incompleto", summary: "Nome incompleto" });
        return this.result("Ficou faltando o nome aí. Manda assim: **meu nome é João**.", {
          source: "Memória da Conversa",
          orbit: "identidade_visitante",
          facet: "nome_incompleto",
          confidence: 5,
        });
      }
      const newName = this.memory.extractUserName(raw);
    this.memory.extractCompany(raw);
    this.memory.extractRole(raw);
    if (newName && previousName && previousName !== newName && /^[A-Za-zÀ-ÿ]{2,}$/.test(newName)) {
      const tI = this.responses.user_identity && this.responses.user_identity.intents && this.responses.user_identity.intents.find(function(i){return i.id === "troca_nome";});
      const tL = (tI && tI.variations) || [];
      let tT = this.pick(tL, "troca_nome").split("NOME").join(newName).split("ANTERIOR").join(previousName);
      this.memory.record(raw, { orbit: "identidade_visitante", facet: "troca_nome", intentId: "troca_nome", summary: "Troca de nome" });
      return this.result(this.humanizer.fill(tT), {
      source: "Memoria da Conversa",
      orbit: "identidade_visitante",
      facet: "troca_nome",
      confidence: 5,
      });
    }
    if (newName && /(?:meu nome|me chamo|sou o|sou a|aqui e|pode me chamar)/i.test(light)) {
      const aI = this.responses.user_identity && this.responses.user_identity.intents && this.responses.user_identity.intents.find(function(i){return i.id === "apresentacao";});
      const aL = (aI && aI.variations) || [];
      this.memory.record(raw, { orbit: "identidade_visitante", facet: "apresentacao", intentId: "apresentacao", summary: "Apresentacao do visitante" });
      return this.result(this.humanizer.fill(this.pick(aL, "apresentacao")), {
      source: "Memoria da Conversa",
      orbit: "identidade_visitante",
      facet: "apresentacao",
      confidence: 5,
      });
    }

    /* 1.9 Pre-check: escolha do bot ("me surpreende", "conta uma boa") --- */
    // FIX B: pre-check escolha_do_bot
    if (/^(me\s+surpreend|conta\s+uma\s+boa|manda\s+uma\s+boa|escolhe\s+(pra|por)\s+mim|decide\s+(pra|por)\s+mim|faz\s+uma\s+escolha|surpreende\s+ai|manda\s+ver)/i.test(norm)) {
      const orbit = this.router.getOrbit('escolha_do_bot');
      const lista = orbit?.facets?.default || ['Escolho sim. Me diz se prefere projeto, stack, contratação ou bastidores.'];
      const body = this.pick(lista, 'escolha_default') // FIX ROT-V2;
      const offer = this.dialog.mainMenuOffer();
      this.dialog.setPending(offer);
      this.memory.record(raw, { orbit: 'escolha_do_bot', facet: 'default', intentId: 'escolha_pre', summary: 'Escolha do bot' });
      const prefixoNeutro = /^(Boa|Vou|Escolho|Fecho|Posso|Claro|Deixa)/i.test(body);
        return this.result((prefixoNeutro ? body : this.humanizer.compose(body, { confidence: 5, withTransition: false })) + "\n\n" + offer.text, { // FIX ROT-V2
        source: 'Assistente Bobby',
        orbit: 'escolha_do_bot',
        facet: 'default',
        confidence: 5,
      });
    }

    /* 1.10 Rotação / expansão da escolha do bot (FIX ESCOLHA-ROT) ----------- */
    // Rotação: "outro caminho", "outra opção", "escolhe outro"
    if (/^(outro|outra|mais\s+um|mais\s+uma|muda|escolhe\s+(outr|de\s+novo|pra\s+mim)|tenta\s+(outr|de\s+novo)|outra\s+op[çc][ãa]o|outro\s+caminho|quero\s+outr[oa]|cad[êe]\s+outr[oa])\b/i.test(norm)) {
      const orbit = this.router.getOrbit('escolha_do_bot');
      const lista = (orbit && orbit.facets && orbit.facets.default) || [];
      if (lista.length) {
        const body = this.pick(lista, 'escolha_default') // FIX ROT-V2;
        const offer = this.dialog.mainMenuOffer();
        this.dialog.setPending(offer);
        this.memory.record(raw, { orbit: 'escolha_do_bot', facet: 'default', intentId: 'escolha_rot', summary: 'Rotação de escolha' });
        const prefixoNeutro = /^(Boa|Vou|Escolho|Fecho|Posso|Claro|Deixa)/i.test(body);
        return this.result((prefixoNeutro ? body : this.humanizer.compose(body, { confidence: 5, withTransition: false })) + "\n\n" + offer.text, { // FIX ROT-V2
          source: 'Assistente Bobby', orbit: 'escolha_do_bot', facet: 'default', confidence: 5,
        });
      }
    }
    // Expansão: "conta ai", "conta a história", "conta ela"
    if (/^(conta\s+a[ií]|conta\s+a\s+hist[óo]ria|conta\s+ela|conta\s+isso|me\s+conta|quero\s+ouvir|quero\s+a\s+hist[óo]ria|pode\s+contar|conta\s+tudo|conta\s+mesmo|manda\s+ver)\b/i.test(norm)) {
      const orbit = this.router.getOrbit('escolha_do_bot');
      const historias = (orbit && orbit.facets && orbit.facets.historias) || [];
      if (historias.length) {
        const body = this.pick(historias, 'escolha_historias');
        const offer = this.dialog.mainMenuOffer();
        this.dialog.setPending(offer);
        this.memory.record(raw, { orbit: 'escolha_do_bot', facet: 'historias', intentId: 'escolha_conta', summary: 'História contada' });
        const prefixoNeutro = /^(Boa|Vou|Escolho|Fecho|Posso|Claro|Deixa)/i.test(body);
        return this.result((prefixoNeutro ? body : this.humanizer.compose(body, { confidence: 5, withTransition: false })) + "\n\n" + offer.text, { // FIX ROT-V2
          source: 'Assistente Bobby', orbit: 'escolha_do_bot', facet: 'historias', confidence: 5,
        });
      }
    }

    /* 1.7 Tocha — palavra que aponta pro proprio Bobby ------------------- */
    if (this.torchData && this.torchData.intents && this.torchData.intents.length) {
      const torchHit = this.detectTorch(raw, norm, tokens);
      if (torchHit) {
        const body = this.pick(torchHit.lista, "tocha:" + torchHit.id + ":" + (torchHit.repeat ? "rep" : "first"));
        const offer = this.dialog.mainMenuOffer();
        this.dialog.setPending(offer);
        this.memory.record(raw, { orbit: "meta_ia", facet: "tocha_" + torchHit.id, intentId: "tocha:" + torchHit.id, summary: "Tocha acesa: " + torchHit.id });
        return this.result(body + "\n\n" + offer.text, {
          source: "Assistente Bobby",
          orbit: "meta_ia",
          facet: "tocha_" + torchHit.id,
          confidence: 5,
        });
      }
    }

    /* 2.b Resposta a uma pergunta que EU fiz --------------------------
       Se a última resposta ofereceu caminhos ("posso seguir por A, B ou C"),
       uma resposta curta do visitante é lida contra essa oferta antes de
       qualquer outro roteamento. */
    const earlyTokens = this.tokenizer.tokenize(raw, { expand: false });

    /* 2.e Dominio especifico (ANTES do exactMatch) */
    if (this.dominios && this.dominios.length) {
      const dom = this.detectDominio(raw, norm, earlyTokens);
      if (dom) return dom;



    // FIX ANCORA-CONTEXTO v4: pronome anaforico herda do historico e RESPONDE direto
    if (this.palavrasProjetos && this.palavrasProjetos.ponte_ancorada) {
      const rawLp = window.LeetNormalizer.light(raw).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const palavrasP = rawLp.split(/\s+/).filter(Boolean);
      const temPronome = palavrasP.some((w) => this.palavrasProjetos.ponte_ancorada.includes(w));
      if (temPronome && palavrasP.length <= 5) {
        const recente = (this.memory.history || []).slice(-6).map((h) => String(h.text || "")).join(" ");
        const ancsList = this.palavrasProjetos.ancoras_outras || [];
        // FIX ANCORA-CONTEXTO v5: preferir ULTIMA ancora + fallback pra orbita
        const cands = ancsList.filter((a) => recente.includes(a));
        const ancEncontrada = cands.length ? cands[cands.length - 1] : null;
        if (ancEncontrada) {
          const ent = this.entities.get(ancEncontrada) || this.entities.entities.find((e) => (e.aliases || []).includes(ancEncontrada) || e.id === ancEncontrada);
          const orbitAlvo = ent ? this.router.getOrbit(ent.orbit) : this.router.orbits.find((o) => (o.subjects || []).includes(ancEncontrada) || (o.keywords || []).includes(ancEncontrada));
          if (orbitAlvo && !ent) {
            const composedOrb = this.composeAnswer({ orbit: orbitAlvo, entity: null, facet: "default" });
            if (composedOrb && composedOrb.body) {
              const offerOrb = this.dialog.buildOffer({ orbitId: orbitAlvo.id, entity: null });
              this.dialog.setPending(offerOrb);
              this.memory.record(raw, { orbit: orbitAlvo.id, entity: null, facet: "default", intentId: "ancora_ctx_orb:" + orbitAlvo.id, summary: this.summarize(composedOrb.body) });
              return this.result(composedOrb.body + (offerOrb ? "\n\n" + offerOrb.text : ""), { source: composedOrb.source, orbit: orbitAlvo.id, facet: "default", confidence: 5 });
            }
          }
          if (ent) {
            const orbitEnt = this.router.getOrbit(ent.orbit);
            const composed = this.composeAnswer({ orbit: orbitEnt, entity: ent, facet: null });
            if (composed && composed.body) {
              const offer = this.dialog.buildOffer({ orbitId: ent.orbit, entity: ent, facet: null });
              this.dialog.setPending(offer);
              this.memory.record(raw, { orbit: ent.orbit, entity: ent.id, facet: "resumo", intentId: "ancora_ctx:" + ent.id, summary: this.summarize(composed.body) });
              return this.result(composed.body + (offer ? "\n\n" + offer.text : ""), { source: composed.source, orbit: ent.orbit, entity: ent.id, facet: "resumo", confidence: 5 });
            }
          }
        }
      }
    }

    // FIX PROJETOS-PRECHECK: ponte-pedido sem ancora -> duvida
    if (this.palavrasProjetos && this.palavrasProjetos.ancoras) {
      const rawL = window.LeetNormalizer.light(raw).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const cls = this.classifyProjetos(rawL);
      if (cls && !cls.furo) {
        const temInterr = /[?]/.test(raw);
        const tokensCount = rawL.split(/\s+/).filter(Boolean).length;
        const temAncoraOutra = (this.palavrasProjetos.ancoras_outras || []).some((w) => rawL.includes(w));
        const temPronome = (this.palavrasProjetos.ponte_ancorada || []).some((w) => rawL.includes(w));
        // FIX CONTEXTO-PONTE: se já existe órbita ativa (≠ smalltalk) com reply recente,
        // 'fala mais' continua nela em vez de perguntar alvo de novo.
        const orbeAtiva = this.memory.activeOrbit;
        const temContexto = orbeAtiva && orbeAtiva !== "smalltalk" && orbeAtiva !== "escolha_do_bot" && this.memory.lastReply && this.memory.lastReply.orbit === orbeAtiva;
        if (!temContexto && cls.ponte === "pedido" && !cls.ancora && !temAncoraOutra && !temPronome && cls.especificadores.length === 0 && tokensCount <= 7) {
          const coringa = temInterr ? "Posso sim. " : "Vamos la entao. ";
          const txt = coringa + "Mas sobre o que, exatamente? Voce ainda nao me disse o alvo. Pode ser um projeto especifico, uma tecnologia, uma empresa ou o perfil do Marcos.";
          const offer = this.dialog.mainMenuOffer();
          this.dialog.setPending(offer);
          this.memory.record(raw, { orbit: "smalltalk", facet: "duvida_projeto", intentId: "duvida_projeto", summary: "Ponte pedido sem ancora" });
          this.memory.aguardandoAlvo = true; // FIX ESPERA-ALVO: marca que perguntou
          return this.result(txt + "\n\n" + offer.text, { source: "Assistente Bobby", orbit: "smalltalk", facet: "duvida_projeto", confidence: 5 });
        }
      }
    }
    }
    // FIX G2: antes de tratar como resposta à oferta pendente, checa se é pergunta real.
    // G2a: interrogativa em QUALQUER posição + 3+ tokens -> pergunta nova, não pick.
    // G2b: token distintivo de OUTRA órbita -> pergunta nova, não pick.
    let skipPending = false;
    // FIX G2b: '?' no texto ORIGINAL também é sinal de pergunta.
    if (/[?]/.test(raw) && earlyTokens.length >= 2) skipPending = true;
    if (/\b(quem|qual|quais|como|onde|quando|por que|porque|o que|quantos?|quantas?)\b/.test(norm) && earlyTokens.length >= 3) skipPending = true;
    if (!skipPending && this.memory.activeOrbit && this.router.tokensByOrbit && earlyTokens.length >= 2) {
      const activeTokens = this.router.tokensByOrbit.get(this.memory.activeOrbit) || new Set();
      const foreign = earlyTokens.some((t) => {
        if (t.length < 3 || activeTokens.has(t)) return false;
        for (const [oid, toks] of this.router.tokensByOrbit) {
          if (oid !== this.memory.activeOrbit && toks.has(t)) return true;
        }
        return false;
      });
      if (foreign) skipPending = true;
    }
    const pick = skipPending ? null : this.dialog.resolvePending(norm, earlyTokens);
    if (pick) {
      const handled = this.handlePendingPick(pick, raw);
      if (handled) return handled;
    }

    /* 2.c Palavras quentes, reações de teste e respostas vagas ----------
       "SOCRAM", "debug", "solto?", "ok", "gostei", "e aí"... sempre levam
       a algum lugar: nó de aprofundamento ou oferta de continuação. */
    const lightHit = this.reaction.detectLight(raw);
    if (lightHit) {
      const handledLight = this.handleLight(lightHit, raw);
      if (handledLight) return handledLight;
    }

    /* 2.d Pergunta idêntica a uma pergunta ou variação autorada de um nó:
       vence o small talk ("comandos de tema" não é pedido de ajuda). */
    const exactEarly = this.dialog.exactMatch(raw, { orbit: this.memory.activeOrbit });
    if (exactEarly) return this.answerNode(exactEarly, raw);

    /* 3. Resposta solta (sim / não / talvez) --------------------------- */
    const standalone = this.polarity.detectStandalone(norm);
    if (standalone && this.memory.history.length > 0 && tokens.length <= 2) {
      const reply = this.polarity.standaloneReply(standalone, this.memory);
      if (reply) {
        // A resposta solta oferece "projetos, stack ou condições": registra a oferta.
        this.dialog.setPending(this.dialog.mainMenuOffer());
        return this.result(reply, { source: "Conversa", orbit: "smalltalk", facet: standalone, confidence: 4 });
      }
    }

    /* 4. Saudação e small talk ----------------------------------------- */
    const social = this.detectSocial(norm, tokens);
    if (social) return social;

    /* 5. Perguntas sobre o próprio visitante --------------------------- */
    const identity = this.detectUserIdentity(norm, tokens);
    if (identity) return identity;

    /* 6. Correção do usuário ------------------------------------------- */
    const correction = this.detectCorrection(norm);
    let correctionPrefix = "";
    let working = raw;
    if (correction.isCorrection) {
      working = correction.cleaned || raw;
      tokens = this.tokenizer.tokenize(working);
    }

    const workingNorm = window.LeetNormalizer.normalize(working);
    // Escolha de tema vale para respostas curtas de menu ("condições", "projetos"),
    // não para perguntas ("ele é PCD?", "qual a stack?"), que seguem o roteamento completo.
    const isQuestionLike = /\?\s*$/.test(working) || /^(ele|ela|qual|quais|como|quando|onde|quem|quanto|quantos|quantas|por que|porque|o que|tem|existe|sabe|pode|aceita|e |eh )\b/.test(workingNorm);
    const topicChoice = isQuestionLike ? null : this.resolveTopicChoice(workingNorm);

    /* 7. Fora de escopo explícito -------------------------------------- */
    if (!topicChoice && this.isHardOffTopic(workingNorm, tokens)) {
      this.memory.record(raw, { orbit: "off_topic", facet: "fora", intentId: "off_topic", summary: "Fora do escopo" });
      const list = this.responses.off_topic?.variations || [];
      return this.result(this.pick(list, "off_topic"), { source: "Orientação de Escopo", orbit: "off_topic", confidence: 3 });
    }

    /* 8. Entidade citada ------------------------------------------------ */
    // usa tokens SEM expansão de sinônimos: sinônimo não identifica satélite
    const rawTokens = this.tokenizer.tokenize(working, { expand: false });
    const resolved = topicChoice ? null : this.entities.resolve(workingNorm, rawTokens);
    let entity = resolved?.entity || null;


    /* 8.a Pergunta que já existe nas árvores de aprofundamento ----------
       Respostas pré-autoradas em camadas (15+10+10+10+5) têm prioridade sobre
       o roteamento genérico, porque cercam o assunto com sub-assuntos. */
    if (!topicChoice && !correction.isCorrection) {
      const earlySuperlative = this.facets.detectSuperlative(workingNorm, { activeOrbit: this.memory.activeOrbit });
      const earlyFacet = this.facets.detect(workingNorm, rawTokens);
      const node = this.dialog.matchQuestion(rawTokens, tokens, {
        orbit: this.memory.activeOrbit,
        entity: entity?.id || null,
        text: working,
      });
      const exactNode = this.dialog.lastExact;
      // Superlativo ("mais demorado") e facetas de método geral ("copiloto")
      // têm tratamento próprio; o nó só responde se cobrir a mesma faceta.
      const guardedFacet = ["pretensao", "vaga_afirmativa", "contratacao", "merito_curriculo", "construcao_curriculo", "pdf_curriculo", "qr_code_curriculo", "galeria_curriculo", "diferenca_pdf_app"].includes(earlyFacet.facet);
      const facetConflict = earlyFacet.facet && earlyFacet.score >= 2.4 && node && node.facet !== earlyFacet.facet &&
        (guardedFacet || (node.facet && ["ia_copiloto", "desafio", "duracao", "study_case", "processo", "rag", "embedding"].includes(earlyFacet.facet)));
      // Um superlativo só bloqueia o nó quando a pergunta é realmente comparativa
      // ("qual projeto foi o mais..."); "primeiro computador" é um fato da história.
      const comparative = earlySuperlative && /\b(mais|menos|menor|maior|primeiro de todos|ultimo)\b/.test(workingNorm) && /\b(projeto|projetos|jogo|jogos|game|games|sistema|ferramenta|empresa|trabalho|experiencia)\b/.test(workingNorm);
      const nodeIgnoresFacet = node && earlyFacet.facet && ["study_case", "processo"].includes(earlyFacet.facet) && node.facet !== earlyFacet.facet && entity && entity.facets?.[earlyFacet.facet];
      // FURA-BOLHA v3: o nó de aprofundamento perde quando o roteador prefere
// OUTRA órbita com força. Evita que nó estreito sequestre pergunta ampla
// (ex.: "o que é python?" cair em nó de cursos 2014-2015).
let orbitConflict = false;
if (node && !exactNode && !entity && !topicChoice) {
  const quickRoute = this.router.route(tokens, { activeOrbit: this.memory.activeOrbit, entityOrbit: null });
  const quickBest = quickRoute.ranked[0];
  if (quickBest && quickBest.orbit !== node.orbit && quickBest.score >= 1.4) orbitConflict = true; // FIX ANCORA-CONTEXTO v5
}
if (node && (exactNode || (!comparative && !facetConflict && !nodeIgnoresFacet && !orbitConflict))) return this.answerNode(node, raw);
    }

    /* 8.9 Guarda: pergunta curta sem sujeito ("Quanto tempo?") --------- */
    // FIX duvida_de_que: se a query tem <= 4 tokens, nenhuma entity ativa
    // nem resolvida, e o facet detectado exige sujeito, pergunta de volta.
    const _hasTorch = rawTokens.some((t) => (this.torchData?.torch_words || []).includes(t));
    if (!topicChoice && !entity && rawTokens.length <= 4 && !_hasTorch) { // FIX TORCH no duvida
      const fInfo = this.facets.detect(workingNorm, rawTokens);
      const EXIGE_SUJEITO = ['duracao', 'tecnologias', 'status', 'link', 'motivo', 'desafio', 'aprendizado', 'conquistas', 'qa', 'arquitetura', 'duvida_de_que'];
      if (fInfo.facet && EXIGE_SUJEITO.includes(fInfo.facet)) {
        // FIX LABEL-DUVIDA: se o facet eh duvida_de_que, pega o proximo ranqueado (o real)
        const labels = { duracao: 'Tempo', tecnologias: 'Tecnologias', status: 'Status', link: 'Link', motivo: 'Motivo', desafio: 'Desafio', aprendizado: 'Aprendizado', conquistas: 'Conquistas', qa: 'QA', arquitetura: 'Arquitetura' };
        let facetReal = fInfo.facet;
        if (facetReal === 'duvida_de_que' && fInfo.ranked) {
          const outro = fInfo.ranked.find((r) => r.id !== 'duvida_de_que');
          if (outro) facetReal = outro.id;
        }
        const label = labels[facetReal] || (facetReal === 'duvida_de_que' ? 'Sobre o que' : facetReal);
        const prefixo = label === 'Sobre o que' ? 'Sobre o que você quer saber o tempo' : `${label} de quê`;
        const txt = `${prefixo}? Ainda não me disse o alvo. Se for algum projeto, empresa ou curso específico, me diz o nome.`;
        const offer = this.dialog.mainMenuOffer();
        this.dialog.setPending(offer);
        this.memory.record(raw, { orbit: 'smalltalk', facet: 'duvida_de_que', intentId: 'duvida', summary: 'Pergunta sem sujeito' });
        return this.result(txt + "\n\n" + offer.text, { source: 'Assistente Bobby', orbit: 'smalltalk', facet: 'duvida_de_que', confidence: 5 });
      }
    }

    /* 9. Faceta e superlativo ------------------------------------------ */
    const facetInfo = this.facets.detect(workingNorm, rawTokens);
    const superlative = this.facets.detectSuperlative(workingNorm, { activeOrbit: this.memory.activeOrbit });

    /* 8.b Checagem de evidência ----------------------------------------
       Perguntas de comparação podem conter palavras que não aparecem como
       nomes de entidades. Deixamos o resolvedor de superlativos responder
       primeiro, para explicar com clareza quando falta uma métrica.
    */
    if (!entity && !topicChoice && !superlative && !this.memory.pendingOffer) {
      const coverage = this.lexicalCoverage(rawTokens);
      if (coverage.unknownStrong.length > 0 || (coverage.total >= 2 && coverage.ratio < 0.45)) {
        return this.sacredUnknown(raw);
      }
    }

    /* 9.b Recuperação léxica: termo desconhecido ou trecho que cita o termo ----
       Só quando nenhuma entidade, escolha de menu ou faceta específica assumiu. */
    const GENERIC_FACETS = new Set(["resumo", "comparacao", "nivel", "quantidade", "status", "link", "duracao", "motivo", "desafio", "aprendizado", "equipe", "arquitetura", "qa", "tecnologias", "experiencia_dev", "sabe_programar"]);
    const specificFacet = facetInfo.facet && facetInfo.score >= 2.4 && !GENERIC_FACETS.has(facetInfo.facet);
    const isFollowUp = this.memory.activeEntity && this.isContinuation(workingNorm, rawTokens, facetInfo.facet);
    if (!entity && !topicChoice && !superlative && !correction.isCorrection && !specificFacet && !isFollowUp) {
      const prior = this.router.route(tokens, { activeOrbit: this.memory.activeOrbit, entityOrbit: null });
      const found = this.retrieveFallback(raw, rawTokens, prior.ranked[0]?.orbit || null);
      if (found) return found;
    }

    /* 10. Roteamento de órbita ----------------------------------------- */
    const routing = topicChoice
      ? { ranked: [], ambiguous: false, corrections: [] }
      : this.router.route(tokens, {
          activeOrbit: this.memory.activeOrbit,
          entityOrbit: entity?.orbit || null,
        });
    let best = routing.ranked[0] || null;
    let orbitId = topicChoice?.orbit || entity?.orbit || best?.orbit || this.memory.activeOrbit;

    // superlativo sem entidade: resolve dentro da órbita ativa/roteada
    let superlativeRanking = null;
    if (superlative && !entity && !topicChoice) {
      let supOrbit = orbitId && orbitId !== "smalltalk" ? orbitId : "projetos";
      if (/\b(projeto|projetos|jogo|jogos|game|games|app|ferramenta)\b/.test(workingNorm)) supOrbit = "projetos";
      if (/\b(empresa|emprego|trabalho|experiencia|cargo)\b/.test(workingNorm)) supOrbit = "experiencia";
      const target = this.entities.resolveSuperlative(superlative, supOrbit);
      if (target) {
        entity = target.entity;
        superlativeRanking = target.ranking;
        orbitId = entity.orbit;
      } else if (supOrbit === "projetos") {
        const text = this.superlativeWithoutComparableData(superlative);
        this.memory.record(raw, {
          orbit: "projetos",
          facet: "comparacao",
          intentId: `projects_superlative:${superlative.id}`,
          summary: text,
          clearEntity: true,
        });
        return this.result(text, {
          source: "Portfólio, comparação sem dados suficientes",
          orbit: "projetos",
          facet: "comparacao",
          confidence: 4,
        });
      }
    }

    // Continuação contextual, por exemplo "e as tecnologias?" ou "quanto tempo levou?".
    // Uma escolha explícita de tema sempre vence o contexto anterior.
    if (!topicChoice && !entity && this.memory.activeEntity && this.isContinuation(workingNorm, rawTokens, facetInfo.facet)) {
      entity = this.entities.get(this.memory.activeEntity);
      if (entity) orbitId = entity.orbit;
    }

    // Uma escolha curta aponta diretamente para uma órbita e uma faceta.
    let facet = correction.isCorrection ? null : topicChoice?.facet || facetInfo.facet;

    // FIX A: se a entity resolvida NÃO tem a faceta pedida, mas a faceta tem
    // home_orbit diferente, abandona a entity e segue pela home.
    if (entity && facetInfo.facet && facetInfo.home && facetInfo.home !== entity.orbit) {
      const entityHasFacet = entity.facets && entity.facets[facetInfo.facet];
      if (!entityHasFacet) {
        entity = null;
        orbitId = facetInfo.home;
      }
    }

    // faceta com "órbita natural" (ex.: pretensão → recrutamento) corrige o roteamento
    if (!topicChoice && !entity && facetInfo.facet && facetInfo.home && facetInfo.score >= 1.6) {
      const homeOrbit = this.router.getOrbit(facetInfo.home);
      const currentHas = !!this.router.getOrbit(orbitId)?.facets?.[facet];
      if (homeOrbit && !currentHas) orbitId = facetInfo.home;
    }

    const orbit = this.router.getOrbit(orbitId);
    facet = this.applyFacetAlias(orbit, facet);
    if (correction.isCorrection && entity) {
      const list = this.responses.correction?.com_entidade || [];
      correctionPrefix = this.humanizer.fill(this.pick(list, "correcao_entidade"), { entidade: entity.name }) + "\n\n";
    }

    // entidade citada sem faceta explícita → responde o resumo dela
    if (entity && !facetInfo.facet && !superlative) facet = null;

    const routeScore = best?.score || 0;
    const confidence = topicChoice ? 4.5 : routeScore + (entity ? 3 : 0) + (facetInfo.score > 0 ? 1.5 : 0);

    /* 11. Composição da resposta --------------------------------------- */
    const composed = this.composeAnswer({ orbit, entity, facet, superlative, superlativeRanking, tokens, workingNorm });

    // Entidade citada + faceta pedida com resposta confirmada na entidade:
    // responde direto, registra memória e já deixa a oferta de continuação.
    if (composed && entity && facet && entity.facets?.[facet] && composed.body) {
      this.memory.resetUnknown();
      const intentKey = `${orbit?.id || entity.orbit}:${entity.id}:${facet}`;
      const repeat = ["pretensao", "contratacao", "adaptacoes", "limitacoes", "contato", "vaga_afirmativa"].includes(facet)
        ? { isRepeat: false }
        : this.memory.checkRepeat(raw, intentKey);
      this.memory.record(raw, {
        orbit: orbit?.id || entity.orbit,
        entity: entity.id,
        facet,
        intentId: intentKey,
        summary: this.summarize(composed.body),
      });
      if (repeat.isRepeat) return this.repeatAnswer(repeat, composed.source, orbit?.id || entity.orbit, facet);
      const offer = this.dialog.buildOffer({ orbitId: orbit?.id || entity.orbit, entity, facet });
      this.dialog.setPending(offer);
      return this.result(composed.body + (offer ? "\n\n" + offer.text : ""), {
        source: composed.source,
        orbit: orbit?.id || entity.orbit,
        facet,
        entity: entity.id,
        confidence: 5,
      });
    }

    if (!composed) {
      // fallback semântico na knowledge base
      const kb = this.searchKnowledge(tokens);
      if (kb && kb.score >= (window.RAG_CONFIG.minConfidence || 2.2)) {
        this.memory.resetUnknown();
        const repeat = this.memory.checkRepeat(raw, "kb:" + kb.id);
        this.memory.record(raw, { orbit: kb.orbit, facet: "kb", intentId: "kb:" + kb.id, summary: this.summarize(kb.content) });
        if (repeat.isRepeat) return this.repeatAnswer(repeat, kb.source);
        const kbOffer = this.dialog.buildOffer({ orbitId: kb.orbit });
        this.dialog.setPending(kbOffer);
        return this.result(this.humanizer.compose(correctionPrefix + kb.content, { confidence: 4, withTransition: false }) + (kbOffer ? "\n\n" + kbOffer.text : ""), {
          source: kb.source,
          orbit: kb.orbit,
          facet: "kb",
          confidence: kb.score,
        });
      }

      // ambiguidade real entre duas órbitas
      if (routing.ambiguous && routing.ranked.length > 1) {
        const opcoes = routing.ranked
          .slice(0, 2)
          .map((r) => this.router.getOrbit(r.orbit)?.label || r.orbit)
          .join(" ou ");
        return this.result(this.humanizer.ambiguity(opcoes), { source: "Desambiguação", confidence: 1.5 });
      }

      return this.sacredUnknown(raw, correction.isCorrection);
    }

    this.memory.resetUnknown();

    const intentKey = `${orbit?.id || "?"}:${entity?.id || "-"}:${facet || "default"}`;
    // Temas sensíveis sempre recebem a resposta institucional completa,
    // nunca a versão encurtada de "pergunta repetida".
    const SENSITIVE = ["pretensao", "contratacao", "adaptacoes", "limitacoes", "contato", "vaga_afirmativa"];
    const repeat = SENSITIVE.includes(facet) ? { isRepeat: false } : this.memory.checkRepeat(raw, intentKey);
    const summary = this.summarize(composed.body);

    this.memory.record(raw, {
      orbit: orbit?.id || null,
      entity: entity?.id || null,
      facet: facet || "default",
      intentId: intentKey,
      summary,
      clearEntity: Boolean(topicChoice && !entity),
    });

    if (repeat.isRepeat) return this.repeatAnswer(repeat, composed.source, orbit?.id, facet);

    /* 12. Polaridade + humanização ------------------------------------- */
    let body = composed.body;
    if (this.polarity.isClosedQuestion(workingNorm)) {
      const pol = this.polarity.resolveAnswerPolarity({ facet, orbit: orbit?.id, normalizedText: workingNorm });
      // Não duplica quando a resposta já começa com "Sim"/"Não"/"Depende".
      const alreadyPolar = /^(sim|não|nao|depende|em parte|parcialmente|positivo|negativo)\b/i.test(body.trim());
      if (pol && !alreadyPolar) {
        const prefix = this.polarity.prefix(pol, this.memory);
        const keepCase = /[.!?]\s*$/.test(prefix) || !/^[A-Za-zÀ-ÿ]/.test(body);
        body = prefix + (keepCase ? body : body.charAt(0).toLowerCase() + body.slice(1));
      }
    }

    const finalText = this.humanizer.compose(correctionPrefix + body, { confidence, withTransition: false });

    // Oferta de continuação: filhos do tema, facetas restantes do satélite ou
    // raízes da órbita. Fica registrada como pendente para a próxima resposta.
    const offer = this.dialog.buildOffer({ orbitId: orbit?.id || null, entity, facet });
    this.dialog.setPending(offer);

    return this.result(finalText + (offer ? "\n\n" + offer.text : ""), {
      source: composed.source,
      orbit: orbit?.id || null,
      facet: facet || "default",
      entity: entity?.id || null,
      confidence,
    });
  }

  /* ------------------- Recuperação léxica nas respostas ------------------- */

  /** Indexa todo texto de resposta (nós, facetas de satélites e de órbitas) para busca por termo. */
  buildPassages() {
    const tok = (t) => this.tokenizer.tokenize(t, { expand: false });
    const P = [];
    for (const node of this.dialog.nodes.values()) {
      P.push({ kind: "node", node, weight: 1, text: `${node.answer} ${node.question} ${(node.variants || []).join(" ")}` });
    }
    for (const entity of this.entities.entities) {
      for (const [facet, list] of Object.entries(entity.facets || {})) {
        (list || []).forEach((text) => P.push({ kind: "entity", entity, facet, weight: 0.9, text: `${text} ${entity.name}` }));
      }
    }
    for (const orbit of this.router.orbits) {
      for (const [facet, list] of Object.entries(orbit.facets || {})) {
        (list || []).forEach((text) => P.push({ kind: "orbit", orbit, facet, weight: 0.85, text }));
      }
    }
    this.passageDf = new Map();
    for (const p of P) {
      p.tokens = new Set(tok(p.text));
      p.tokens.forEach((t) => this.passageDf.set(t, (this.passageDf.get(t) || 0) + 1));
    }
    this.passages = P;
    this.passageVocab = [...this.passageDf.keys()];
  }

  isKnownWord(t) {
    return (
      this.passageDf.has(t) || this.router.inverted.has(t) || this.tokenizer.synonymIndex.has(t) ||
      this.facets.allKeyTokens?.has(t) || this.dialog.vocab.has(t) || this.englishKnown.has(t)
    );
  }

  /** Palavras que o visitante escreveu com inicial maiúscula (ou SIGLA), fora do começo da frase. */
  properTokens(raw) {
    const out = new Set();
    String(raw).split(/\s+/).forEach((w, i) => {
      const clean = w.replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9+#.]+$/g, "");
      const allCaps = clean.length >= 3 && clean === clean.toUpperCase() && /[A-Z]/.test(clean);
      if ((i > 0 && /^[A-ZÀ-Ý]/.test(clean)) || allCaps) out.add(window.LeetNormalizer.light(clean).replace(/[^a-z0-9]/g, ""));
    });
    return out;
  }

  /**
   * Fallback antes do roteamento genérico: (1) se a pergunta cita um termo que não existe em
   * nenhuma resposta da base, diz isso com honestidade; (2) se o termo existe, devolve o trecho
   * que de fato o cita. Evita a resposta genérica "Ele não vem do zero..." para qualquer coisa.
   */
  retrieveFallback(raw, rawTokens, prefOrbit = null) {
    if (!this.passages.length) return null;
    const proper = this.properTokens(raw);
    // Verbos e palavras de enchimento ("ele sabe/usa/conhece X?") não carregam a busca.
    const NOISE = new Set(["sabe", "sabia", "usa", "usou", "usar", "conhece", "conhecer", "trabalhou", "trabalha", "faz", "fez", "fazer", "tem", "teve", "ja", "aceita", "pode", "consegue", "gosta", "algum", "alguma", "coisa", "mesmo", "verdade", "pouco", "muito", "bem", "quer", "foi", "ser", "esta", "estao"]);
    const q = [...new Set(rawTokens)].filter((t) => t.length >= 3 && !DialogState.GENERIC.has(t) && !NOISE.has(t) && !this.englishKnown.has(t));
    if (!q.length) return null;

    const known = [];
    const unknown = [];
    const shortUnknown = [];
    for (let t of q) {
      let df = this.passageDf.get(t) || 0;
      if (!df && t.length >= 5) {
        const fix = window.FuzzyMatcher.findBestMatch(t, this.passageVocab, 0.86);
        if (fix) { t = fix.match; df = this.passageDf.get(t) || 0; }
      }
      if (df) known.push({ t, df });
      else if (!this.isKnownWord(t)) {
        if (t.length >= 5 || proper.has(t)) unknown.push(t);
        else shortUnknown.push(t);
      }
    }

    if (unknown.length) return this.unknownTerm(raw, unknown[0]);
    // Palavra curta que ninguém conhece ("var", "let") ao lado de uma única palavra comum:
    // não inventa trecho por causa da palavra comum; admite que não tem.
    if (shortUnknown.length && known.length <= 1) return this.sacredUnknown(raw);
    if (!known.length) return null;

    const N = this.passages.length;
    const idf = (df) => Math.log(1 + N / df);
    // Distintivo = raro na base (até 4% dos trechos). Palavra comum demais não ancora resposta.
    const rare = Math.max(30, Math.floor(N * 0.04));
    const informative = known.filter((k) => k.df <= rare);
    if (!informative.length) return null;
    known.length = 0;
    known.push(...informative);
    const totalIdf = known.reduce((a, k) => a + idf(k.df), 0);
    let best = null;
    for (const p of this.passages) {
      let hit = 0, distinct = false;
      for (const k of known) if (p.tokens.has(k.t)) { hit += idf(k.df); distinct = true; }
      if (!distinct) continue;
      const coverage = hit / totalIdf;
      // Trecho curto e focado vence trecho longo que só menciona o termo de passagem.
      const density = 1 / Math.sqrt(Math.max(1, p.tokens.size / 12));
      const pOrbit = p.kind === "node" ? p.node.orbit : p.kind === "entity" ? p.entity.orbit : p.orbit.id;
      const orbitBoost = prefOrbit && pOrbit === prefOrbit ? 1.3 : 1;
      const score = hit * p.weight * (0.5 + 0.5 * coverage) * density * orbitBoost;
      if (coverage >= 0.6 && hit >= 2.5 && (!best || score > best.score)) best = { p, score };
    }
    if (!best) return null;

    const { p } = best;
    if (p.kind === "node") return this.answerNode(p.node, raw);
    if (p.kind === "entity") {
      const orbit = this.router.getOrbit(p.entity.orbit);
      const body = (p.entity.facets[p.facet] || []).find((t) => p.text.startsWith(t)) || p.text;
      return this.deliver({ body, source: `${orbit?.source || "Portfólio"} · ${p.entity.name}`, orbitId: p.entity.orbit, entity: p.entity, facet: p.facet, raw });
    }
    const body = (p.orbit.facets[p.facet] || []).find((t) => t === p.text) || p.text;
    return this.deliver({ body, source: p.orbit.source || p.orbit.label, orbitId: p.orbit.id, facet: p.facet, raw });
  }

  /** O visitante citou um termo que não aparece em nada da base: honestidade, sem chute, com caminhos reais. */
  unknownTerm(raw, termNorm) {
    const level = this.memory.registerUnknown();
    if (level > 1) return this.sacredUnknown(raw);
    const shown = String(raw).split(/\s+/).map((w) => w.replace(/[^A-Za-zÀ-ÿ0-9+#.]/g, "")).find((w) => window.LeetNormalizer.light(w).replace(/[^a-z0-9]/g, "") === termNorm) || termNorm;
    const lines = this.responses.unknown_sacred?.com_termo || ["Sobre **{termo}** não tenho registro na base do Marcos, e prefiro não afirmar o que ele não contou."];
    const text = this.pick(lines, "sem_termo").replace(/\{termo\}/g, shown);
    this.memory.record(raw, { orbit: null, facet: null, intentId: "sem_termo", summary: "Termo fora da base" });
    return this.respondWithOptions(raw, text, ["sk04", "sk07", "tr01"], { facet: "sem_dado_termo", orbit: "desconhecido", source: "Fora da Base de Conhecimento" });
  }

  /* ----------------------- Caminho garantido e reações ----------------------- */

  /** Oferta de continuação coerente com o contexto atual (oferta pendente > satélite > órbita > menu). */
  nudge() {
    const pending = this.memory.pendingOffer;
    if (pending && pending.options && pending.options.length) {
      // FIX C: só usa pendente se for da órbita ativa (evita contaminação).
      const pendingOrbit = pending.options[0] && pending.options[0].orbit;
      if (!pendingOrbit || pendingOrbit === this.memory.activeOrbit) {
        return { options: pending.options, text: this.dialog.render(pending.options) };
      }
    }
    const entity = this.memory.activeEntity ? this.entities.get(this.memory.activeEntity) : null;
    const orbitId = this.router.getOrbit(this.memory.activeOrbit) ? this.memory.activeOrbit : null;
    const offer = entity || orbitId ? this.dialog.buildOffer({ orbitId, entity, facet: this.memory.lastFacet }) : null;
    if (offer) return offer;
    const menu = this.dialog.mainMenuOffer();
    return { options: menu.options, text: menu.text };
  }

  /** Se a resposta deste turno não deixou uma oferta rastreada, anexa uma. */
  ensureForwardPath(res) {
    if (!res || res.action === "reset" || res.farewell) return res;
    const fresh = this.memory.pendingOffer && this.memory.pendingTurn === this.memory.turn;
    if (fresh) return res;
    const offer = this.nudge();
    this.dialog.setPending(offer);
    res.text = res.text + "\n\n" + offer.text;
    res.offered = true;
    return res;
  }

  /** Responde com um texto e oferece nós específicos (ou o contexto atual). */
  respondWithOptions(raw, text, nodeIds, meta) {
    const options = (nodeIds || []).map((id) => this.dialog.get(id)).filter(Boolean).map((node) => this.dialog.nodeOption(node));
    const offer = options.length ? { options, text: this.dialog.render(options) } : this.nudge();
    this.dialog.setPending(offer);
    this.memory.record(raw, { orbit: null, facet: null, intentId: `${meta.facet}:turn`, summary: this.summarize(text) });
    return this.result(text + "\n\n" + offer.text, {
      source: meta.source || "Conversa",
      orbit: meta.orbit || "smalltalk",
      facet: meta.facet,
      confidence: 5,
    });
  }

  /** Crítica negativa ao candidato: calma, com fatos; na 4ª vez entra na escada de moderação. */
  handleHostile(raw) {
    this.memory.hostileCount = (this.memory.hostileCount || 0) + 1;
    if (this.memory.hostileCount >= 4) return this.handleProfanity();
    const { list, options } = this.reaction.hostileText(this.memory.hostileCount);
    const text = this.pick(list.length ? list : ["Respeito sua opinião. Posso responder com fatos."], "hostil:" + this.memory.hostileCount);
    return this.respondWithOptions(raw, text, options, { facet: "hostil", orbit: "moderacao", source: "Conversa" });
  }

  /** Palavras quentes, reações de teste e respostas vagas. */
  handleLight(hit, raw) {
    if (hit.kind === "hot") {
      const node = this.dialog.get(hit.entry.node);
      return node ? this.answerNode(node, raw) : null;
    }
    if (hit.kind === "vague") {
      // FIX CONTEXTO-VAGO: se há órbita ativa com reply recente, 'mais/continua'
      // NÃO é vago — herda a órbita em vez de responder lead genérico.
      const orbeAt = this.memory.activeOrbit;
      const temCtx = orbeAt && orbeAt !== "smalltalk" && orbeAt !== "escolha_do_bot" && this.memory.lastReply && this.memory.lastReply.orbit === orbeAt;
      if (temCtx) return null;
      const lead = this.pick(this.reaction.vagueLeads(hit.bucket), "vago:" + hit.bucket);
      const offer = this.nudge();
      this.dialog.setPending(offer);
      this.memory.record(raw, { orbit: null, facet: null, intentId: "vago:" + hit.bucket, summary: "Resposta curta sem pergunta" });
      return this.result(`${lead} ${offer.text}`, { source: "Conversa", orbit: "smalltalk", facet: "vago", confidence: 5 });
    }
    const intent = hit.intent;
    if (intent.type === "repeat") {
      const last = this.memory.lastReply;
      const text = last
        ? this.pick(intent.variations, "repeat:" + intent.id).replace("{resumo}", this.summarize(last.text))
        : this.pick(intent.empty || ["Ainda não tenho o que repetir."], "repeat:empty");
      return this.respondWithOptions(raw, text, [], { facet: "repeat" });
    }
    const text = this.pick(intent.variations, "reaction:" + intent.id);
    return this.respondWithOptions(raw, text, intent.options_nodes || [], { facet: intent.id });
  }

  /** Reinicia a conversa (usado quando a moderação dispara o reset). */
  resetSession(opts = {}) {
    const fresh = new window.SessionMemory();
    Object.assign(this.memory, fresh);
    this.memory.abuseCount = opts.abuseCarry || 0;
  }

  /* ------------------------ Aprofundamento (diálogo) ------------------------ */

  /** Responde um nó das árvores de aprofundamento e oferece os sub-assuntos dele. */
  answerNode(node, raw) {
    const orbit = this.router.getOrbit(node.orbit);
    const entity = node.entity ? this.entities.get(node.entity) : null;
    const revisit = this.dialog.wasAsked(node.id);
    this.dialog.markAsked(node.id);

    let body = node.answer;
    if (revisit) {
      const prefixes = this.responses.dialog_followups?.revisit || this.dialog.templates.revisit || [""];
      body = this.pick(prefixes, "revisit") + body;
    }

    return this.deliver({
      body,
      source: `${orbit?.source || orbit?.label || "Perfil"} · aprofundamento`,
      orbitId: node.orbit,
      entity,
      facet: node.facet || "aprofundamento",
      raw,
      confidence: 5,
      node,
      humanize: !revisit,
    });
  }

  /** Trata a resposta curta do visitante a uma oferta pendente. */
  handlePendingPick(pick, raw) {
    const tpl = this.dialog.templates || {};

    if (pick.type === "reask") {
      const text = this.pick(tpl.reask || ["Por qual você prefere começar: {opcoes}?"], "reask").replace("{opcoes}", this.dialog.pendingLabels());
      return this.result(text, { source: "Conversa", orbit: this.memory.activeOrbit, facet: "reask", confidence: 5 });
    }

    if (pick.type === "decline") {
      this.dialog.setPending(this.dialog.mainMenuOffer());
      return this.result(this.pick(tpl.decline || ["Tudo bem."], "decline"), { source: "Conversa", orbit: "smalltalk", facet: "decline", confidence: 5 });
    }

    const option = pick.option;
    if (!option) return null;

    if (option.kind === "node") {
      const node = this.dialog.get(option.id);
      return node ? this.answerNode(node, raw) : null;
    }

    if (option.kind === "facet") {
      const entity = this.entities.get(option.entity);
      const orbit = this.router.getOrbit(option.orbit);
      if (!entity) return null;
      const composed = this.composeAnswer({ orbit, entity, facet: option.facet });
      if (!composed) return null;
      return this.deliver({ body: composed.body, source: composed.source, orbitId: option.orbit, entity, facet: option.facet, raw, confidence: 5 });
    }

    if (option.kind === "orbit") {
      const orbit = this.router.getOrbit(option.orbit);
      const composed = this.composeAnswer({ orbit, entity: null, facet: "default" });
      if (!composed) return null;
      return this.deliver({ body: composed.body, source: composed.source, orbitId: option.orbit, entity: null, facet: "default", raw, confidence: 5, clearEntity: true });
    }
    return null;
  }

  /** Entrega padrão: registra memória, humaniza e anexa a próxima oferta. */
  deliver({ body, source, orbitId, entity = null, facet = "default", raw, confidence = 5, node = null, humanize = true, clearEntity = false }) {
    this.memory.resetUnknown();
    this.memory.record(raw, {
      orbit: orbitId,
      entity: entity?.id || null,
      facet,
      intentId: node ? "deep:" + node.id : `${orbitId}:${entity?.id || "-"}:${facet}`,
      summary: this.summarize(body),
      clearEntity,
    });

    const offer = this.dialog.buildOffer({ node, orbitId, entity, facet });
    this.dialog.setPending(offer);

    const text = (humanize ? this.humanizer.compose(body, { confidence, withTransition: false }) : body) + (offer ? "\n\n" + offer.text : "");
    return this.result(text, { source, orbit: orbitId, facet, entity: entity?.id || null, confidence, node: node?.id || null });
  }

  superlativeWithoutComparableData(superlative) {
    const messages = {
      mais_recente: "Não tenho datas de início confirmadas para todos os projetos, então não vou apontar um como o mais recente no chute. Posso informar o status de cada projeto ou falar dos trabalhos que estão ativos agora.",
      mais_antigo: "Tenho registros históricos, mas não datas de início comparáveis para todo o portfólio. Prefiro não apontar um projeto como o mais antigo sem base suficiente.",
      maior: "Não tenho uma métrica comparável de tamanho ou volume de código para todos os projetos. O que posso afirmar é que o Marcos descreve o Núcleo Nexus como seu projeto mais ambicioso.",
      menor: "Não tenho uma medida comparável de escopo ou tamanho para dizer qual projeto é o menor. Prefiro não transformar uma impressão em fato.",
      mais_rapido: "Não tenho a duração confirmada de cada projeto. Posso comparar os status e o escopo, mas não dizer qual foi concluído mais rápido sem esse dado.",
      mais_demorado: "Não tenho a duração confirmada de cada projeto. Prefiro não inventar um prazo ou afirmar qual demorou mais.",
    };
    return messages[superlative?.id] || "Não tenho dados comparáveis suficientes para responder isso sem fazer suposições.";
  }

  /* --------------------------- Composição ------------------------------ */

  composeAnswer({ orbit, entity, facet, superlative, superlativeRanking }) {
    const pickFrom = (list, key) => (Array.isArray(list) && list.length ? this.pick(list, key) : null);

    if (entity) {
      const facets = entity.facets || {};
      const requestedSpecificFacet = facet && !["default", "resumo"].includes(facet);
      const knownFacetAnswer = requestedSpecificFacet ? pickFrom(facets[facet], `${entity.id}:${facet}`) : null;
      const EXPERIENCE_LEVEL = ["tempo_total", "industria", "conquistas", "experiencia_dev"];
      const crossOrbitId = facet === "ia_copiloto" ? "projetos" : facet === "sabe_programar" ? "recrutamento" : EXPERIENCE_LEVEL.includes(facet) ? "experiencia" : null;
      const crossOrbit = crossOrbitId ? this.router.getOrbit(crossOrbitId) : null;
      const crossOrbitAnswer = requestedSpecificFacet && !knownFacetAnswer
        ? pickFrom(crossOrbit?.facets?.[facet], `${crossOrbitId}:${facet}`)
        : null;

      // Não substitui um detalhe ausente por uma afirmação inventada nem por
      // um resumo que pareça responder à pergunta específica.
      if (requestedSpecificFacet && !knownFacetAnswer && !crossOrbitAnswer) {
        const facetLabel = this.facets.facets.find((item) => item.id === facet)?.label || facet;
        const summary = pickFrom(facets.resumo, `${entity.id}:resumo`);
        const body = `Não tenho um detalhe confirmado sobre **${facetLabel.toLowerCase()}** de **${entity.name}** na minha base. Prefiro não completar essa lacuna com suposição.${summary ? `\n\nO que está confirmado: ${summary}` : ""}`;
        const orbitLabel = orbit?.source || orbit?.label || "Portfólio";
        return { body, source: `${orbitLabel} · ${entity.name}` };
      }

      // Algumas facetas descrevem o método geral do candidato, não a
      // implementação de um satélite específico.
      if (crossOrbitAnswer) {
        return { body: crossOrbitAnswer, source: crossOrbit?.source || crossOrbit?.label || "Perfil" };
      }

      // A entidade citada sempre tem prioridade. Se a faceta foi pedida e existe
      // na entidade, ela responde direto; o nó só entra se cobrir a mesma faceta.
      let body =
        pickFrom(facets[facet], `${entity.id}:${facet}`) ||
        pickFrom(facets.resumo, `${entity.id}:resumo`) ||
        pickFrom(facets.default, `${entity.id}:default`) ||
        (facet ? this.orbitFacetFallback(orbit, facet, entity) : null);

      if (!body) return null;

      if (superlative) {
        const label = {
          mais_recente: "O mais recente é",
          mais_antigo: "O registro histórico mais antigo é",
          maior: "O maior, segundo uma métrica comparável, é",
          menor: "O menor, segundo uma métrica comparável, é",
          mais_rapido: "O que levou menos tempo foi",
          mais_demorado: "O que levou mais tempo foi",
          mais_ambicioso: "O projeto que o Marcos descreve como mais ambicioso é",
        }[superlative.id];
        const extra = superlativeRanking && superlativeRanking.length > 1
          ? `\n\nRanking: ${superlativeRanking.map((e, i) => `${i + 1}. ${e.name}`).join(" · ")}`
          : "";
        body = `${label} **${entity.name}**.\n\n${body}${extra}`;
      }

      const orbitLabel = orbit?.source || orbit?.label || "Portfólio";
      return { body, source: `${orbitLabel} · ${entity.name}` };
    }

    if (orbit) {
      const facets = orbit.facets || {};
      const body =
        pickFrom(facets[facet], `${orbit.id}:${facet}`) || pickFrom(facets.default, `${orbit.id}:default`);
      if (!body) return null;
      return { body, source: orbit.source || orbit.label };
    }

    return null;
  }

  /** Alias de faceta por órbita (ex.: "quantidade" em experiência = tempo total). */
  applyFacetAlias(orbit, facet) {
    if (!orbit || !facet) return facet;
    const alias = (orbit.facet_aliases || {})[facet];
    return alias || facet;
  }

  orbitFacetFallback(orbit, facet, entity) {
    const list = orbit?.facets?.[facet];
    if (!Array.isArray(list) || !list.length) return null;
    const text = this.pick(list, `${orbit.id}:${facet}`);
    return entity ? text : text;
  }

  /* ------------------------ Intenções especiais ------------------------ */

  /**
   * Resolve uma resposta curta a uma opção conversacional, como
   * "condições", "stack" ou "projetos". Esse resultado tem prioridade sobre
   * a entidade ativa e não herda o projeto da pergunta anterior.
   */
  resolveTopicChoice(normalizedText) {
    if (!this.topicChoices.length) return null;

    const clean = String(normalizedText || "")
      .replace(/[^a-z0-9\\s]/g, " ")
      .replace(/\\s+/g, " ")
      .trim();
    if (!clean || clean.split(" ").length > 7) return null;

    const variants = new Set([clean]);
    let short = clean
      .replace(/^(boa|legal|certo|otimo|otima|beleza|entendi|ok)\\s+/, "")
      .replace(/^(entao\\s+)?(quero|queria|gostaria de|vamos de|vamos falar de|me fale de|me fala de|falar de|sobre)\\s+/, "")
      .replace(/^(saber sobre|saber de|ver|conhecer)\\s+/, "")
      .replace(/^(as|os|a|o)\\s+/, "")
      .trim();
    if (short) variants.add(short);

    const matches = [];
    for (const choice of this.topicChoices) {
      for (const phrase of choice.phrases || []) {
        const candidate = window.LeetNormalizer.light(phrase);
        if ([...variants].some((v) => v === candidate)) {
          matches.push({ choice, phrase: candidate, score: candidate.length + 10 });
          continue;
        }
        // Fuzzy apenas para uma opção curta isolada, não para frases longas.
        if (short.split(" ").length === 1 && candidate.split(" ").length === 1 && short.length >= 5) {
          const score = window.FuzzyMatcher.blended(short, candidate);
          if (score >= 0.84) matches.push({ choice, phrase: candidate, score: score * 10 });
        }
      }
    }

    if (!matches.length) return null;
    matches.sort((a, b) => b.score - a.score);
    const best = matches[0];
    const sameChoice = matches.filter((m) => m.choice.id === best.choice.id);
    const otherChoice = matches.find((m) => m.choice.id !== best.choice.id && Math.abs(m.score - best.score) < 0.5);
    if (otherChoice) return null;
    return { id: best.choice.id, orbit: best.choice.orbit, facet: best.choice.facet || "default" };
  }

  detectSocial(norm, tokens) {
    const greetingRx = /^(oi+|ola+|oie+|opa|eai|e ai|fala|salve|hey|hi|hello|bom dia|boa tarde|boa noite|tudo bem|tudo bom|bom dia bobby|fala bobby)\b/;
    // FIX GREETING-SOZINHO: se apos a saudacao tem conteudo real (pergunta), NAO eh saudacao
    const _afterGreet = norm.replace(/^(oi+|ola+|oie+|opa|eai|e ai|fala|salve|hey|hi|hello|bom dia|boa tarde|boa noite|tudo bem|tudo bom|bom dia bobby|fala bobby)\b[,\s]*/i, "").trim();
    const _isOnlyGreeting = _afterGreet.length <= 2;
    const greetWords = norm.split(/\s+/).filter(Boolean).length;
    const greetAsks = /\?/.test(norm) || /\b(qual|quais|como|quando|onde|quem|quanto|quantos|por que|o que)\b/.test(norm);
    if (greetingRx.test(norm) && _isOnlyGreeting && norm.length < 42 && (greetWords <= 3 || !greetAsks)) {
      const data = this.responses.greeting || {};
      // FIX 1b: saudacao repetida -> resaudacao (nao repete o 'ola')
      const jaCumprimentou = (this.memory.topicCount['greeting'] || 0) >= 1;
      if (jaCumprimentou && data.resaudacao && data.resaudacao.length) {
        const body = this.pick(data.resaudacao, 'resaudacao');
        this.memory.record(norm, { orbit: 'smalltalk', facet: 'saudacao_rep', intentId: 'greeting', summary: 'Saudacao repetida' });
        this.dialog.setPending(this.dialog.mainMenuOffer());
        return this.result(body, { source: 'Assistente Bobby', orbit: 'smalltalk', facet: 'saudacao_rep', confidence: 5 });
      }
      let prefix = "";
      const hour = new Date().getHours();
      const periodo = hour < 12 ? "manha" : hour < 18 ? "tarde" : "noite";
      if (/bom dia|boa tarde|boa noite/.test(norm)) {
        prefix = this.pick(data.por_periodo?.[periodo] || [], "periodo:" + periodo);
      }
      const list = this.memory.userName && data.com_nome ? data.com_nome : data.variations || [];
      const body = this.humanizer.fill(this.pick(list, "greeting"));
      this.memory.record(norm, { orbit: "smalltalk", facet: "saudacao", intentId: "greeting", summary: "Saudação" });
      this.dialog.setPending(this.dialog.mainMenuOffer());
      return this.result(prefix + body, { source: "Assistente Bobby", orbit: "smalltalk", facet: "saudacao", confidence: 5 });
    }

    for (const intent of this.responses.smalltalk?.intents || []) {
      const wordCount = norm.split(/\s+/).filter(Boolean).length;
      const hit = intent.patterns.some((p) => {
        const phrase = p.includes(" ");
        const rx = new RegExp("\\b" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
        if (rx.test(norm)) {
          // Frases só valem em mensagens curtas; palavra solta curta só vale quase sozinha.
          if (phrase) return wordCount <= p.split(" ").length + 2;
          return p.length >= 6 ? wordCount <= 4 : wordCount <= 2;
        }
        return !phrase && p.length >= 6 && wordCount <= 3 && tokens.some((t) => window.FuzzyMatcher.isTypo(t, p));
      });
      if (hit) {
        this.memory.record(norm, { orbit: "smalltalk", facet: intent.id, intentId: "smalltalk:" + intent.id, summary: intent.id });
        return this.result(this.pick(intent.variations, "smalltalk:" + intent.id), {
          source: "Conversa",
          orbit: "smalltalk",
          facet: intent.id,
          confidence: 4,
          farewell: intent.id === "despedida",
        });
      }
    }
    return null;
  }

  detectUserIdentity(norm, tokens) {
    const intents = this.responses.user_identity?.intents || [];
    for (const intent of intents) {
      if (intent.id === "apresentacao" || intent.id === "empresa_visitante") continue;
      const hit = intent.patterns.some(
        (p) => norm.includes(p) || window.FuzzyMatcher.tokenSetSimilarity(p.split(" ").filter((w) => w.length > 2), tokens) >= 0.7
      );
      if (!hit) continue;

      let list;
      if (intent.id === "sabe_quem_sou") {
        list = this.memory.userName ? intent.com_nome : intent.sem_nome;
      } else {
        list = intent.variations;
      }
      const body = this.humanizer.fill(this.pick(list, "identidade:" + intent.id));
      this.memory.record(norm, {
        orbit: "identidade_visitante",
        facet: intent.id,
        intentId: "identidade:" + intent.id,
        summary: this.summarize(body),
      });
      return this.result(body, {
        source: "Memória da Conversa",
        orbit: "identidade_visitante",
        facet: intent.id,
        confidence: 5,
      });
    }
    return null;
  }

  detectCorrection(norm) {
    const patterns = this.responses.correction?.patterns || [];
    const hit = patterns.find((p) => norm.includes(p));
    if (!hit) return { isCorrection: false };
    const cleaned = norm
      .replace(/^(nao|nao e isso|nao foi isso|nao era isso|na verdade|corrigindo|errei|digitei errado)[,\s]+/g, "")
      .replace(/\b(eu disse|eu falei|quis dizer|queria dizer|me refiro a|estou falando de|to falando de)\b/g, " ")
      .trim();
    return { isCorrection: true, cleaned };
  }

  isContinuation(norm, tokens, facet = null) {
    if (!this.memory.activeEntity || tokens.length > 6) return false;

    // FURA-BOLHA v2: se a query tem token de OUTRA órbita, não é continuação —
    // nem mesmo com prefixo "e/mas/então". Ex.: "então é embedding?" não é
    // continuação do assunto anterior; é uma pergunta nova sobre glossário.
    const ent = this.entities.get(this.memory.activeEntity);
    if (ent && this.router.tokensByOrbit) {
      const entTokens = this.router.tokensByOrbit.get(ent.orbit) || new Set();
      const SKIP = new Set(["entao", "tambem", "ah", "certo", "coisa"]);
      const content = tokens.filter((t) => t.length > 2 && !DialogState.GENERIC.has(t) && !SKIP.has(t));
      const hasForeign = content.some((t) => {
        if (entTokens.has(t)) return false;
        for (const [oid, toks] of this.router.tokensByOrbit) {
          if (oid !== ent.orbit && toks.has(t)) return true;
        }
        return false;
      });
      if (hasForeign) return false;
    }

    // Marcadores claros de continuação: "e o desafio?", "mas o status?".
    if (/^(e|mas|entao|tambem|ah|certo)\s+/.test(norm)) return true;

    // Perguntas curtas só herdam o projeto quando uma faceta foi reconhecida.
    const contextualFacets = new Set([
      "tecnologias", "desafio", "aprendizado", "status", "link", "duracao",
      "arquitetura", "qa", "equipe", "motivo", "resumo",
    ]);
    return contextualFacets.has(facet) && tokens.length <= 5;
  }

  isHardOffTopic(norm, tokens) {
    for (const rx of this.responses.off_topic?.regex || []) {
      try {
        if (new RegExp(rx, "i").test(norm)) return true;
      } catch (e) { /* regex inválida no JSON: ignora */ }
    }
    const list = this.responses.off_topic?.topicos_fora || [];
    for (const topic of list) {
      if (norm.includes(topic)) {
        // só considera fora de escopo se nenhuma entidade/órbita forte aparecer
        const resolved = this.entities.resolve(norm, tokens);
        if (!resolved) return true;
      }
    }
    return false;
  }

  handleProfanity() {
    const count = this.memory.recordAbuse();
    const data = this.responses.profanity_response || {};
    const level = Math.min(count, 3);
    const lines = (data.niveis || {})[String(level)] || data.variations || ["Vamos manter a conversa profissional?"];
    const text = this.pick(lines, "profanity:" + level);
    if (level >= 3) {
      // Terceiro aviso: o chat é reiniciado pela interface (action: "reset").
      return this.result(text, { source: "Moderação", orbit: "moderacao", facet: "profanidade", confidence: 5, action: "reset" });
    }
    const offer = this.nudge();
    this.dialog.setPending(offer);
    return this.result(text + "\n\n" + offer.text, { source: "Moderação", orbit: "moderacao", facet: "profanidade", confidence: 5 });
  }

  repeatAnswer(repeat, source, orbitId = null, facet = null) {
    const data = this.responses.repeat_detection || {};
    const base = this.humanizer.fill(this.pick(data.variations || [], "repeat"), { resumo: repeat.summary });
    const offer = this.dialog.buildOffer({ orbitId: orbitId || this.memory.activeOrbit, entity: this.memory.activeEntity ? this.entities.get(this.memory.activeEntity) : null, facet });
    this.dialog.setPending(offer || this.dialog.mainMenuOffer());
    const desvio = offer ? "\n\n" + offer.text : "";
    return this.result(base + desvio, {
      source: source || "Memória da Conversa",
      orbit: orbitId,
      facet,
      confidence: 4,
      repeat: true,
    });
  }

  classifyProjetos(rawLight) {
    const p = this.palavrasProjetos;
    if (!p || !p.ancoras) return null;
    const has = (w) => rawLight.includes(w);
    let ancora = null;
    for (const k of Object.keys(p.ancoras)) {
      if (has(k)) { ancora = k; break; }
      const sins = p.ancoras[k] || [];
      for (const s of sins) { if (has(s)) { ancora = k; break; } }
      if (ancora) break;
    }
    const especs = [];
    for (const k of Object.keys(p.especificadores || {})) {
      const lista = p.especificadores[k] || [];
      for (const w of lista) { if (has(w)) { especs.push(k); break; } }
    }
    let ponte = null;
    for (const k of Object.keys(p.pontes || {})) {
      const lista = p.pontes[k] || [];
      for (const w of lista) { if (has(w)) { ponte = k; break; } }
      if (ponte) break;
    }
    let furo = false;
    for (const fr of (p.furos || [])) { if (has(fr)) { furo = true; break; } }
    return { ancora, especificadores: especs, ponte, furo };
  }

  detectTorch(raw, norm, tokens) {
    if (!this.torchData) return null;
    // FIX TORCH-RAW: usa raw normalizado direto, sem tokenize (que filtra stopwords)
    const rawLight0 = window.LeetNormalizer.light(raw).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const words = rawLight0.split(/\s+/).filter(Boolean);
    if (words.length > 8) return null;
    const torch = new Set(this.torchData.torch_words || []);
    const fora = new Set(this.torchData.fora_words || []);
    const temTorch = words.some((t) => torch.has(t));
    if (!temTorch) return null;
    // FIX TOCHA-V2: quem criou/fez/programou/construiu -> deixa pro pipeline normal (meta_ia/quem_fez)
    if (/\b(quem|criou|fez|programou|construiu|desenvolveu)\b/.test(words.join(" "))) return null;
    const temFora = words.some((t) => fora.has(t));
    if (temFora) return null;
    const content = words;
    const light = window.LeetNormalizer.light(raw).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    let intentEncontrado = null;
    for (const intent of this.torchData.intents) {
      for (const rx of intent.regex || []) {
        try { if (new RegExp(rx, "i").test(light)) { intentEncontrado = intent; break; } } catch (e) {}
      }
      if (intentEncontrado) break;
    }
    if (!intentEncontrado && content.length <= 3 && temTorch) {
      intentEncontrado = this.torchData.intents.find((i) => i.id === "identidade");
    }
    if (!intentEncontrado) return null;
    // FIX TOCHA-V2: contador por intent (nao global)
    if (!this.memory.selfAsked) this.memory.selfAsked = {};
    const keyIntent = "tocha:" + intentEncontrado.id;
    this.memory.selfAsked[keyIntent] = (this.memory.selfAsked[keyIntent] || 0) + 1;
    const repeat = this.memory.selfAsked[keyIntent] > 1;
    const lista = repeat ? (intentEncontrado.repeat || intentEncontrado.first) : (intentEncontrado.first || []);
    return { id: intentEncontrado.id, lista, repeat };
  }

  detectDominio(raw, norm, tokens) {
    // FIX v5: dominio primeiro, fragmento depois, fallback o_que_e
    if (!this.dominios || !this.dominios.length) return null;
    const rawLight = window.LeetNormalizer.light(raw);
    const qTokens = new Set(rawLight.split(/\s+/).filter(Boolean));
    // 1) escolher o DOMINIO pelo melhor alias
    let bestDom = null;
    for (const d of this.dominios) {
      let domScore = 0;
      for (const a of d.aliases || []) {
        const al = window.LeetNormalizer.light(a);
        if (rawLight.includes(al)) domScore = Math.max(domScore, 1.0 + al.length * 0.02);
        else { const s = window.FuzzyMatcher.blended(al, rawLight); if (s >= 0.86) domScore = Math.max(domScore, s); }
      }
      if (domScore > 0 && (!bestDom || domScore > bestDom.score)) bestDom = { dom: d, score: domScore };
    }
    if (!bestDom) return null;
    // 2) dentro do dominio, escolher o FRAGMENTO pelo melhor gatilho
    const d = bestDom.dom;
    let bestFrag = null;
    let bestFragScore = 0;
    for (const f of d.fragmentos || []) {
      for (const g of f.gatilhos || []) {
        const gl = window.LeetNormalizer.light(g);
        const gt = gl.split(/\s+/).filter((x) => x.length > 1);
        if (!gt.length) continue;
        let hit = 0;
        for (const t of gt) if (qTokens.has(t)) hit++;
        const ratio = hit / gt.length;
        let score = 0;
        if (ratio === 1) score = gt.length * 0.3 + 1.5;
        else if (ratio >= 0.75) score = ratio * 1.2;
        else { const fb = window.FuzzyMatcher.blended(gl, rawLight); if (fb >= 0.80) score = fb * 1.1; }
        if (score > bestFragScore) { bestFragScore = score; bestFrag = f; }
      }
    }
    // 3) fallback: se nenhum fragmento bate, usa o "o_que_e"
    if (!bestFrag) {
      bestFrag = (d.fragmentos || []).find((f) => f.id === 'o_que_e') || (d.fragmentos || [])[0];
      bestFragScore = 1.5;
    }
    if (!bestFrag) return null;
    const texto = bestFrag.texto;
    const offer = this.dialog.buildOffer({ orbitId: 'experiencia' });
    this.dialog.setPending(offer);
    const finalText = texto + (offer ? "\n\n" + offer.text : "");
    this.memory.record(raw, { orbit: 'experiencia', entity: d.id, facet: 'dominio_' + bestFrag.id, intentId: 'dom:' + d.id + ':' + bestFrag.id, summary: this.summarize(texto) });
    return this.result(finalText, {
      source: 'Dominio · ' + d.label,
      orbit: 'experiencia',
      facet: 'dominio_' + bestFrag.id,
      entity: d.id,
      confidence: Math.min(5, bestFragScore + 1),
    });
  }
  sacredUnknown(raw) {
    const level = this.memory.registerUnknown();
    const data = this.responses.unknown_sacred || {};
    const list = (data.niveis || {})[String(level)] || (data.niveis || {})["1"] || [];
    let body = this.pick(list, "sagrada:" + level);
    this.memory.record(raw, { orbit: "desconhecido", facet: "sem_dado", intentId: "unknown", summary: "Assunto fora da base" });
    this.dialog.clearPending();
    return this.result(body, { source: "Fora da Base de Conhecimento", orbit: "desconhecido", facet: "sem_dado", confidence: 0 });
  }

  /**
   * Cobertura léxica: quantos tokens de conteúdo da pergunta existem em algum
   * vocabulário conhecido (banco mesh, sinônimos, entidades, facetas, KB).
   */
  lexicalCoverage(rawTokens) {
    const content = rawTokens.filter((t) => t.length >= 3);
    if (!content.length) return { ratio: 1, total: 0, unknown: [], unknownStrong: [] };

    const unknown = [];
    const unknownStrong = [];
    for (const t of content) {
      const direct =
        this.router.inverted.has(t) ||
        this.tokenizer.synonymIndex.has(t) ||
        this.entities.tokenFreq.has(t) ||
        this.facets.allKeyTokens?.has(t) ||
        this.dialog.vocab.has(t) ||
        this.englishKnown.has(t) ||
        this.knowledge.some((c) => c._tokens.includes(t));
      if (direct) continue;

      // ainda pode ser erro de digitação de algo conhecido
      const corrected = this.router.expandTokens([t]);
      if (corrected.length) continue;

      unknown.push(t);
      if (t.length >= 5) unknownStrong.push(t);
    }
    return {
      ratio: (content.length - unknown.length) / content.length,
      total: content.length,
      unknown,
      unknownStrong,
    };
  }

  /* -------------------------- Knowledge base --------------------------- */

  searchKnowledge(tokens) {
    let best = null;
    for (const chunk of this.knowledge) {
      const score = window.SimilarityCalculator.score(tokens, chunk._tokens, chunk.keywords, chunk._title);
      if (!best || score > best.score) best = { ...chunk, score };
    }
    return best;
  }

  /** Sugestões contextuais para os chips da interface. */
  suggestions() {
    const orbit = this.router.getOrbit(this.memory.activeOrbit);
    if (orbit && orbit.followups?.length) return orbit.followups;
    return ["Quer saber de projetos, habilidades, experiência ou contratação?"];
  }
}

window.RagRanker = RagRanker;
