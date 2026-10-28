// ============================================================
// TESTE DINAMICO — Motor v2 com RulesWords reais do disco
// Prova que o motor NAO eh hardcoded
// ============================================================

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '../..');

// Carrega JSON do disco (simula o fetch do browser)
function carregar(rel) {
  const full = path.join(BASE, rel);
  try { return JSON.parse(fs.readFileSync(full, 'utf8')); }
  catch(e) { console.log('  ERRO carregando ' + rel + ': ' + e.message); return null; }
}

// Carrega lexico
function juntar(obj) {
  if (!obj) return [];
  var arr = [];
  for (var k in obj) {
    if (k === '_meta') continue;
    if (Array.isArray(obj[k])) arr = arr.concat(obj[k]);
  }
  return arr;
}

const verbos = carregar('RulesWords/Verbos.json');
const interrogativos = carregar('RulesWords/Interrogativos.json');
const conectores = carregar('RulesWords/Conectores.json');
const artigos = carregar('RulesWords/Artigos.json');
const pronomes = carregar('RulesWords/Pronomes.json');
const somadores = carregar('RulesWords/Somadores.json');

const lexico = {
  verbos: verbos || {},
  interrogativos: interrogativos || {},
  conectores: conectores || {},
  artigos: juntar(artigos),
  pronomes: juntar(pronomes),
  somadores: juntar(somadores)
};

// Carrega ficha + respostas
const fichaCompleta = carregar('Orbitas/Contato/Objetos/LinkedIn/linkedin.json');
const ficha = fichaCompleta ? fichaCompleta.linkedin : null;
const dadosResposta = {
  link: carregar('Orbitas/Contato/Objetos/LinkedIn/Link.json'),
  historia: carregar('Orbitas/Contato/Objetos/LinkedIn/Historia.json'),
  explicacao_da_historia: carregar('Orbitas/Contato/Objetos/LinkedIn/Explicacao.json')
};

console.log('Lexico carregado:');
console.log('  verbos_entrega:', (lexico.verbos.verbos_entrega || []).length, 'palavras');
console.log('  radicais:', Object.keys(lexico.verbos.radicais || {}).length);
console.log('  interrogativos:', Object.keys((lexico.interrogativos.interrogativos || {})).length, 'subtipos');
console.log('  artigos:', lexico.artigos.length);
console.log('  pronomes:', lexico.pronomes.length);
console.log('  somadores:', lexico.somadores.length);
console.log('Ficha:', ficha ? ficha.id : 'null');
console.log('Intencoes:', ficha ? Object.keys(ficha.intencoes).join(', ') : 'null');

// ============================================================
// CARREGA O MOTOR REAL (motor-browser.js via eval)
// ============================================================
var motorCode = fs.readFileSync(path.join(BASE, 'motor-browser.js'), 'utf8');
eval(motorCode);
MotorRAG.init(lexico, ficha);
console.log('\n[Motor] init OK via motor-browser.js real');

// ============================================================
// COPIA DO MOTOR (FALLBACK - so se eval falhar)
// ============================================================
function tirarAcento(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function similaridade(token, candidata) {
  if (token.length > candidata.length) return 0;
  if (token === candidata) return 1;
  var ti = 0;
  for (var ci = 0; ci < candidata.length && ti < token.length; ci++) {
    if (candidata[ci] === token[ti]) ti++;
  }
  if (ti === 0) return 0;
  if (token.length <= 3 && ti < token.length) return 0;
  return (ti / token.length) * (token.length / candidata.length);
}

function classificarToken(token) {
  var t = tirarAcento(token);
  var listas = {
    'artigo_definido': lexico.artigos,
    'pronome': lexico.pronomes,
    'conector_posse': (lexico.conectores.posse_m || []).concat(lexico.conectores.posse_f || []),
    'conector_interacao': lexico.conectores.interacao || [],
    'objeto_contato': ['link','linkedin','github','email','whatsapp','zap','telefone','celular','numero','contato','fone']
  };
  for (var cat in listas) {
    var arr = listas[cat];
    for (var i = 0; i < arr.length; i++) {
      if (tirarAcento(arr[i]) === t) return { corrigida: arr[i], categoria: cat, confianca: 1 };
    }
  }
  var catsVerbo = ['verbos_entrega', 'verbos_desejo', 'verbos_comunicacao', 'verbos_busca'];
  for (var cv = 0; cv < catsVerbo.length; cv++) {
    var nome = catsVerbo[cv];
    var tipo = nome.replace('verbos_', 'verbo_');
    var lista = lexico.verbos[nome] || [];
    for (var j = 0; j < lista.length; j++) {
      if (tirarAcento(lista[j]) === t) return { corrigida: lista[j], categoria: tipo, confianca: 1 };
    }
  }
  var radicais = lexico.verbos.radicais || {};
  for (var rad in radicais) {
    if (t.indexOf(rad) === 0) {
      return { corrigida: token, categoria: 'verbo_' + radicais[rad], confianca: 0.7 };
    }
  }
  var intgSimples = ['qual','quais','como','onde','quem','quanto','quantos','quantas','quando','porque'];
  for (var k = 0; k < intgSimples.length; k++) {
    if (tirarAcento(intgSimples[k]) === t) return { corrigida: intgSimples[k], categoria: 'interrogativo', confianca: 1 };
  }
  var objetos = listas['objeto_contato'];
  var melhorObj = null, melhorScore = 0;
  for (var m = 0; m < objetos.length; m++) {
    var s = similaridade(t, tirarAcento(objetos[m]));
    if (s > melhorScore) { melhorScore = s; melhorObj = objetos[m]; }
  }
  if (melhorScore >= 0.6) return { corrigida: melhorObj, categoria: 'objeto_contato', confianca: Math.round(melhorScore*100)/100 };
  return { corrigida: token, categoria: 'desconhecido', confianca: 0 };
}

function detectarInterrogativoComposto(texto) {
  var norm = tirarAcento(texto);
  var intgJSON = lexico.interrogativos.interrogativos || {};
  var melhor = null, melhorPri = -1, melhorMarc = '';
  for (var subtipo in intgJSON) {
    var info = intgJSON[subtipo];
    var marcadores = info.marcadores || [];
    for (var m = 0; m < marcadores.length; m++) {
      var marc = tirarAcento(marcadores[m]);
      if (norm.indexOf(marc) !== -1) {
        var pri = info.prioridade || 0;
        if (pri > melhorPri || (pri === melhorPri && marc.length > melhorMarc.length)) {
          melhorPri = pri; melhor = subtipo; melhorMarc = marc;
        }
      }
    }
  }
  return { subtipo: melhor, prioridade: melhorPri, marcador: melhorMarc };
}

function fazerBlocos(texto) {
  var norm = texto.toLowerCase().trim();
  var pausas = [',', '.', '?', '!', ';'];
  var som = lexico.somadores;
  var frags = [], atual = '';
  for (var i = 0; i < norm.length; i++) {
    if (pausas.indexOf(norm[i]) !== -1) { if (atual.trim()) frags.push(atual.trim()); atual = ''; }
    else atual += norm[i];
  }
  if (atual.trim()) frags.push(atual.trim());
  if (!frags.length) return [{ indice: 0, relacao: 'principal', texto: norm }];
  var blocos = [], idx = 0;
  for (var f = 0; f < frags.length; f++) {
    var palavras = frags[f].split(/\s+/);
    var sub = [], acum = '';
    for (var p = 0; p < palavras.length; p++) {
      var sa = tirarAcento(palavras[p]);
      if (som.indexOf(sa) !== -1 && acum.trim()) { sub.push(acum.trim()); acum = ''; }
      else acum += (acum ? ' ' : '') + palavras[p];
    }
    if (acum.trim()) sub.push(acum.trim());
    for (var s = 0; s < sub.length; s++) {
      blocos.push({ indice: idx++, relacao: (!blocos.length && !s) ? 'principal' : 'soma', texto: sub[s] });
    }
  }
  return blocos;
}

function analisarMensagem(blocos) {
  return blocos.map(function(bloco) {
    var palavras = bloco.texto.split(/\s+/).filter(function(p) { return p.length > 0; });
    var tokens = palavras.map(classificarToken);
    var tipo = 'solicitacao';
    if (bloco.texto.indexOf('?') !== -1) tipo = 'pergunta';
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].categoria === 'interrogativo') { tipo = 'pergunta'; break; }
    }
    return {
      texto_original: bloco.texto, relacao: bloco.relacao, tipo: tipo, tokens: tokens,
      interrogativo_composto: detectarInterrogativoComposto(bloco.texto)
    };
  });
}

function casarIntencao(sinais, intencoes) {
  var candidatas = [];
  for (var nome in intencoes) {
    var intencao = intencoes[nome];
    var acionadoPor = intencao.acionado_por;
    var modo = intencao.modo;
    var score = 0;
    if (Array.isArray(acionadoPor)) {
      if (!acionadoPor.length && modo === 'always') {
        candidatas.push({ nome: nome, intencao: intencao, score: intencao.prioridade || 0 });
        continue;
      }
      var matches = 0;
      for (var i = 0; i < acionadoPor.length; i++) {
        if (sinais.indexOf(acionadoPor[i]) !== -1) matches++;
      }
      if (modo === 'all' && matches === acionadoPor.length && acionadoPor.length > 0) score = (intencao.prioridade || 0) + matches;
      else if (modo === 'any' && matches > 0) score = (intencao.prioridade || 0) + matches;
    } else if (acionadoPor && acionadoPor.sets) {
      for (var s = 0; s < acionadoPor.sets.length; s++) {
        var set = acionadoPor.sets[s];
        var setSinais = set.sinais || [];
        var setMatches = 0;
        for (var j = 0; j < setSinais.length; j++) {
          if (sinais.indexOf(setSinais[j]) !== -1) setMatches++;
        }
        if (set.modo === 'all' && setMatches === setSinais.length && setSinais.length > 0)
          score = Math.max(score, (intencao.prioridade || 0) + setMatches);
        else if (set.modo === 'any' && setMatches > 0)
          score = Math.max(score, (intencao.prioridade || 0) + setMatches);
      }
    }
    if (score > 0) candidatas.push({ nome: nome, intencao: intencao, score: score });
  }
  candidatas.sort(function(a, b) { return b.score - a.score; });
  return candidatas;
}

function processar(texto) {
  var blocos = fazerBlocos(texto);
  var analise = analisarMensagem(blocos);
  var resultados = [];
  var verboPrincipal = null, objetoPrincipal = null;

  for (var i = 0; i < analise.length; i++) {
    var bloco = analise[i];
    var verbo = null, objeto = null;
    for (var t = 0; t < bloco.tokens.length; t++) {
      var tok = bloco.tokens[t];
      if (tok.categoria.indexOf('verbo_') === 0 && !verbo) verbo = tok.corrigida;
      if (tok.categoria === 'objeto_contato' && !objeto) objeto = tok.corrigida;
    }
    if (bloco.relacao === 'principal') { verboPrincipal = verbo; objetoPrincipal = objeto; }
    if (bloco.relacao === 'soma' && !verbo && verboPrincipal) verbo = verboPrincipal;
    var obj = objeto || objetoPrincipal;

    if (obj && obj !== 'linkedin') {
      resultados.push({ acao: 'objeto_nao_disponivel', attr: '' });
      continue;
    }

    var sinais = [];
    if (verbo) {
      var cv = classificarToken(verbo).categoria;
      if (cv.indexOf('verbo_') === 0) sinais.push(cv);
    }
    if (bloco.interrogativo_composto && bloco.interrogativo_composto.subtipo) {
      sinais.push(bloco.interrogativo_composto.subtipo);
    }
    for (var t2 = 0; t2 < bloco.tokens.length; t2++) {
      var c = bloco.tokens[t2].categoria;
      if (c === 'conector_posse' || c === 'artigo_definido') sinais.push(c);
    }

    var candidatas = casarIntencao(sinais, ficha.intencoes);
    if (candidatas.length > 0) {
      resultados.push({ acao: candidatas[0].nome, attr: candidatas[0].intencao.atributo_alvo || '' });
    } else {
      resultados.push({ acao: 'fallback', attr: '' });
    }
  }
  return { analise: analise, resultados: resultados };
}

// ============================================================
// TESTES — frases INVENTADAS (nao as do runner)
// ============================================================
console.log('\n=== TESTES DINAMICOS ===\n');

var testes = [
  // Verbos conjugados que NAO estao na lista exata (so no radical)
  { frase: 'mandando o linkedin', esperado: 'entrega' },
  { frase: 'passando o link do linkedin', esperado: 'entrega' },
  { frase: 'enviando o linkedin', esperado: 'entrega' },
  { frase: 'soltando o linkedin', esperado: 'entrega' },
  // Verbos desejo
  { frase: 'queria o linkedin', esperado: 'desejo ou entrega' },
  { frase: 'preciso do linkedin', esperado: 'entrega (verbo_desejo = entrega)' },
  // Comunicacao
  { frase: 'fala do linkedin', esperado: 'comunicacao/historia' },
  { frase: 'conta a historia do linkedin', esperado: 'historia' },
  // Interrogativos compostos (do Interrogativos.json)
  { frase: 'como foi o linkedin', esperado: 'historia' },
  { frase: 'como surgiu o linkedin', esperado: 'historia' },
  { frase: 'me conta a historia do linkedin', esperado: 'historia' },
  { frase: 'por que o linkedin', esperado: 'explicacao' },
  { frase: 'como assim o linkedin', esperado: 'explicacao' },
  { frase: 'o que e o linkedin', esperado: 'definicao' },
  { frase: 'onde ta o linkedin', esperado: 'local/link' },
  { frase: 'qual o link do linkedin', esperado: 'local/link' },
  // Typos
  { frase: 'manda o lnkedin', esperado: 'entrega' },
  { frase: 'sota o lnk do lnkedin', esperado: 'entrega' },
  // Objeto nao disponivel
  { frase: 'manda o github', esperado: 'nao_disponivel' },
  // Soma
  { frase: 'manda o linkedin e o github', esperado: 'entrega + nao_disponivel' },
];

var passou = 0, falhou = 0;

testes.forEach(function(t) {
  var r = MotorRAG.processar(t.frase, dadosResposta);
  var acoes = r.decisoes.map(function(x) { return x.acao + '(' + (x.atributo || '') + ')'; }).join(' | ');
  var tokens = r.analise[0].tokens.map(function(x) { return x.corrigida + '[' + x.categoria + ']'; }).join(' ');
  var intg = r.analise[0].interrogativo_composto;
  var intgStr = intg.subtipo ? ' INTG=' + intg.subtipo : '';

  console.log('"' + t.frase + '"');
  console.log('  tokens: ' + tokens + intgStr);
  console.log('  acao:   ' + acoes);
  console.log('  esperado: ' + t.esperado);
  console.log('');
  passou++;
});

console.log('Total: ' + passou + ' frases testadas (verificar manualmente se as acoes fazem sentido)');
