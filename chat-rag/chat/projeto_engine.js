class ProjetoEngine {
  constructor() {
    this.isReady = false;
    this.lego = null;
    this.askContact = [];
    this.ansContact = null;
    this.askPretensao = [];
    this.ansPretensao = null;
    this.memoriaSujeito = null;
    this.memoriaOrbita = null;
    this.historicoCanais = [];
    this.turnAtual = 0;
  }

  async init() {
    const base = window.RAG_CONFIG.base || 'chat-rag/';
    const fetchJson = async (p) => {
      const r = await fetch(base + '../' + p);
      if (!r.ok) throw new Error('404 ' + p);
      return r.json();
    };
    try {
      const [lego, aC, ansC, aP, ansP] = await Promise.all([
        fetchJson('ProjetoNovoRag/Contato/LegoContact.json'),
        fetchJson('ProjetoNovoRag/Contato/AskContact.json'),
        fetchJson('ProjetoNovoRag/Contato/AnswerContact.json'),
        fetchJson('ProjetoNovoRag/Recrutador/Pretensao/AskPretensao.json'),
        fetchJson('ProjetoNovoRag/Recrutador/Pretensao/AnswerPretensao.json')
      ]);
      this.lego = lego;
      this.askContact = (aC.perguntas || []).map(p => ({ q: p, tokens: this.tokFuzzy(p) }));
      this.ansContact = ansC;
      this.askPretensao = (aP.perguntas || []).map(p => ({ q: p, tokens: this.tokFuzzy(p) }));
      this.ansPretensao = ansP;
      this.isReady = true;
      console.log('[ProjetoEngine] Prateleiras do Mercado prontas.');
    } catch (e) {
      console.error('[ProjetoEngine] falha:', e);
    }
  }

  tokFuzzy(text) {
    let clean = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ');
    clean = clean.replace(/\bgit\b/g, 'github').replace(/\b(?:zap|zapzap|wpp|whats)\b/g, 'whatsapp').replace(/\b(?:celular|fone|numero)\b/g, 'telefone').replace(/\bmail\b/g, 'email');
    return clean.split(/\s+/).filter(w => w.length > 1);
  }

  answer(query) {
    if (!this.isReady) return null;
    this.turnAtual++;
    // FIX FOCO ABSOLUTO: O motor só responde se a frase tiver âncora de contato ou salário.
    const qLight = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const temAncoraContato = /zap|whatsapp|whats|wpp|email|mail|github|git|linkedin|contato|contatinho|telefone|numero|celular|fone|link/.test(qLight);
    const temAncoraSalario = /salario|pretensao|remuneracao|valor|faixa|beneficios|clt|pj|junior|ganhar|custa/.test(qLight);
    if (!temAncoraContato && !temAncoraSalario) return null; // Foco total: nada de roubar perfil ou projetos
 

    // TENTA O LEGO PRIMEIRO
    const legoRes = this.answerLego(query);
    if (legoRes) return legoRes;

    // SE O LEGO FALHOU, CAI NA SIMILARIDADE (553 PERGUNTAS)
    return this.answerFuzzy(query);
  }

  answerLego(query) {
    const tokens = this.tokFuzzy(query);
    if (!tokens.length) return null;

    let verboAcao = null;
    let objeto = null;
    let sujeito = null;

    // 1. Varre as prateleiras
    for (const t of tokens) {
      for (const [acao, verbos] of Object.entries(this.lego.prateleira_verbos)) {
        if (verbos.includes(t)) verboAcao = acao;
      }
      for (const [tipo, objList] of Object.entries(this.lego.prateleira_objetos)) {
        if (objList[t]) objeto = { nome: t, tipo, ...objList[t] };
      }
      if (this.lego.prateleira_sujeitos.includes(t)) sujeito = t;
    }

    if (sujeito) this.memoriaSujeito = sujeito;

    // 2. Regras da Prateleira
    if (objeto) {
      // Pessoa não é transferível (Passa o Marcos?)
      if (objeto.tipo === 'pessoas') {
        if (verboAcao === 'entrega') {
          return { text: 'Não dá pra passar ele mesmo, mas posso passar o contato dele. Quer o WhatsApp?', source: 'Contato', orbit: 'contato' };
        }
        return null; // Deixa o Fuzzy lidar (ex: "quem é o marcos")
      }

      // Ambíguos precisam de contexto (Quero o link?)
      if (objeto.tipo === 'ambiguos') {
        // FIX LINK CONTEXTO: Se estamos na orbita contato, pergunta qual link (github ou linkedin)
        if (this.memoriaSujeito || this.memoriaOrbita === 'contato') {
          return { text: 'Qual link você quer? O GitHub dele ou o LinkedIn?', source: 'Contato', orbit: 'contato' };
        }
        return null; // Se for de projetos, deixa o ranker principal achar o link do projeto
      }

      // Canais precisam de sujeito se for "número" ou "telefone" solto
      if (objeto.nome === 'numero' || objeto.nome === 'telefone') {
        if (!this.memoriaSujeito && !tokens.includes('marcos') && !tokens.includes('marcao')) {
          return { text: 'Número de quem? O contato do Marcos ou de outra pessoa?', source: 'Contato', orbit: 'contato' };
        }
        // FIX: se tem memoriaSujeito e nao foi pedido zap direto, entrega numero sem repeticao
        this.memoriaOrbita = 'contato';
        const A = this.ansContact;
        const linhas = A.receitas['whatsapp'].linhas;
        this.historicoCanais.push({ canal: 'whatsapp', turn: this.turnAtual });
        return { text: this.preencher(linhas.join('\n'), A), source: 'Contato Direto', orbit: 'contato' };
      }

      // Se tem verbo de AÇÃO de entrega + Objeto de Canal -> Responde
      if (verboAcao === 'entrega' || verboAcao === 'desejo') {
        this.memoriaOrbita = 'contato';
        return { text: this.montaContato(query), source: 'Contato Direto', orbit: 'contato', facet: 'default' };
      }
    }

    return null; // Se não tem objeto ou não tem verbo, deixa o Fuzzy tentar
  }

  answerFuzzy(query) {
    const qTokens = this.tokFuzzy(query);
    if (!qTokens.length) return null;

    const _GEN = new Set(['tem','da','de','do','o','a','e','ou','se','no','na','em','ao','os','as','um','uma','por','pra','que','é','sao','foi','ser','esta','ha','ele','ela','voce','vc','me','te','mim','quero','quer','queria','preciso','gostaria','posso','pode','poderia','fala','falar','fale','conta','contar']);
    const _qSet = new Set(qTokens);

    let bestC = { score: 0, q: '' };
    for (const item of this.askContact) {
      const ov = item.tokens.filter(t => _qSet.has(t) && !_GEN.has(t)).length;
      if (ov === 0) continue;
      const sim = qTokens.length <= 2 
        ? (qTokens.filter(t => item.tokens.includes(t)).length / qTokens.length)
        : window.FuzzyMatcher.tokenSetSimilarity(qTokens, item.tokens);
      if (sim > bestC.score) bestC = { score: sim, q: item.q };
    }

    let bestP = { score: 0, q: '' };
    for (const item of this.askPretensao) {
      const ov = item.tokens.filter(t => _qSet.has(t) && !_GEN.has(t)).length;
      if (ov === 0) continue;
      const sim = window.FuzzyMatcher.tokenSetSimilarity(qTokens, item.tokens);
      if (sim > bestP.score) bestP = { score: sim, q: item.q };
    }

    const _th = qTokens.length <= 3 ? 0.40 : (qTokens.length > 6 ? 0.35 : 0.55);

    if (bestC.score >= _th && bestC.score >= bestP.score) {
      this.memoriaOrbita = 'contato';
      return { text: this.montaContato(query), source: 'Contato · Fuzzy (' + Math.round(bestC.score * 100) + '%)', orbit: 'contato', facet: 'default', score: bestC.score };
    }

    if (bestP.score >= _th && bestP.score > bestC.score) {
      return { text: this.montaPretensao(query), source: 'Pretensao · Fuzzy (' + Math.round(bestP.score * 100) + '%)', orbit: 'recrutamento', facet: 'pretensao', score: bestP.score };
    }

    return null;
  }

  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  preencher(tpl, ansObj) {
    const D = ansObj.dados;
    const F = ansObj.frases;
    const v = Object.assign({}, D);
    for (const [k, arr] of Object.entries(F)) { if (Array.isArray(arr)) v[k] = this.pick(arr); }
    let txt = tpl;
    for (let i = 0; i < 3; i++) { for (const [k, val] of Object.entries(v)) { txt = txt.split('{' + k + '}').join(String(val)); } }
    return txt;
  }

  montaContato(query) {
    const q = query.toLowerCase();
    const A = this.ansContact;
    let canais = 0;
    if (q.includes('github') || q.includes('git')) canais++;
    if (q.includes('linkedin')) canais++;
    if (q.includes('email') || q.includes('mail')) canais++;
    if (q.includes('zap') || q.includes('whatsapp') || q.includes('whats')) canais++;
    if (q.includes('contato') || q.includes('contatinho')) canais++;

    let receita = 'whatsapp';
    if (canais >= 2) receita = 'pacote';
    else if (q.includes('github') || q.includes('git')) receita = 'github';
    else if (q.includes('linkedin')) receita = 'linkedin';
    else if (q.includes('email') || q.includes('mail')) receita = 'email';
    else if (q.includes('contato') || q.includes('contatinho')) receita = 'pacote';

    const rec = A.receitas[receita];
    const pediuWhatsDireto = q.includes('zap') || q.includes('whatsapp') || q.includes('whats');
    const wppRecente = !pediuWhatsDireto && this.canalEnviadoRecentemente('whatsapp', 3);
    let linhas = (wppRecente && rec.linhas_rep) ? rec.linhas_rep : rec.linhas;

    this.historicoCanais.push({ canal: receita, turn: this.turnAtual });
    if (!wppRecente) this.historicoCanais.push({ canal: 'whatsapp', turn: this.turnAtual });
    if (this.historicoCanais.length > 20) this.historicoCanais.shift();

    return this.preencher(linhas.join('\n'), A);
  }

  montaPretensao(query) {
    const q = query.toLowerCase();
    const A = this.ansPretensao;
    let receita = 'evasiva_oferta';
    if (q.includes('junior')) receita = 'junior_perfil';
    else if (q.includes('beneficio')) receita = 'copiloto_beneficios';
    else if (q.includes('teste') || q.includes('bug')) receita = 'evasiva_teste';
    else if (q.includes('reciclagem') || q.includes('tempo')) receita = 'reciclagem_junior';
    else if (q.includes('fala logo') || q.includes('direto')) receita = 'insiste';
    return this.preencher(A.receitas[receita].linhas.join('\n'), A);
  }

  canalEnviadoRecentemente(canal, janela) {
    const limite = this.turnAtual - (janela || 3);
    return this.historicoCanais.some(h => h.canal === canal && h.turn >= limite);
  }
}

window.projetoEngine = new ProjetoEngine();
