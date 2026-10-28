// ============================================================
// RUNNER DE TESTE — motor RAG
// Uso: node engine/_test/runner.js
//
// PRA TROCAR DE BIBLIOTECA: muda a linha BIBLIOTECA abaixo.
// ============================================================

const BIBLIOTECA = './TestContato'; // <<<< LINHA PRA TROCAR
const path = require('path');

const lib = require(BIBLIOTECA);
const MakeBlock = require('../MakeBlock/index.js');
const Fuzzy = require('../FuzzyFuncionario/index.js');
const Boss = require('../FuzzyBoss/index.js');

const BASE_DIR = path.resolve(__dirname, '../..');

let passou = 0, falhou = 0;

function ok(msg) { passou++; console.log(' \x1b[32m\u2713\x1b[0m ' + msg); }
function erro(msg){ falhou++; console.log(' \x1b[31m\u2717\x1b[0m ' + msg); }
function titulo(t){ console.log('\n\x1b[33m\u2501\u2501\u2501 ' + t + ' \u2501\u2501\u2501\x1b[0m'); }

console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
console.log('\u2551 TESTE MOTOR RAG \u2014 Biblioteca: ' + lib.nome.padEnd(7) + ' \u2551');
console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');

// ============================================================
titulo('1. MAKEBLOCK \u2014 contagem de blocos');
// ============================================================
lib.blocosEsperados.forEach(function(caso) {
 var blocos = MakeBlock.fazerBlocos(caso.frase);
 var qtd = blocos.length;
 if (qtd === caso.qtd) {
 ok('"' + caso.frase + '" \u2192 ' + qtd + ' bloco(s)');
 } else {
 erro('"' + caso.frase + '" \u2192 esperado ' + caso.qtd + ', veio ' + qtd);
 console.log(' ' + JSON.stringify(blocos.map(b => b.texto)));
 }
});

// ============================================================
titulo('2. MAKEBLOCK \u2014 detalhe dos blocos');
// ============================================================
lib.frases.forEach(function(f) {
 const blocos = MakeBlock.fazerBlocos(f);
 console.log(' "' + f + '"');
 blocos.forEach(function(b) {
 console.log(' [' + b.indice + '] ' + b.relacao.padEnd(9) + ' "' + b.texto + '"');
 });
});

// ============================================================
titulo('3. FUZZY \u2014 correcao de palavras');
// ============================================================
lib.palavras.forEach(function(p) {
 const r = Fuzzy.corrigirPalavra(p);
 const flag = r.status === 'nao_entendi' ? '\x1b[31m?\x1b[0m' : ' ';
 console.log(' ' + flag + ' ' + p.padEnd(10) + ' \u2192 ' + String(r.corrigida).padEnd(12) + ' [' + r.categoria.padEnd(18) + '] ' + r.confianca);
});

// ============================================================
titulo('4. FUZZY \u2014 teste de OVERWRITE (link vs linkedin)');
// ============================================================
lib.overwrite.forEach(function(caso) {
 const r = Fuzzy.corrigirPalavra(caso.token);
 if (r.corrigida === caso.esperado) {
 ok(caso.token.padEnd(10) + ' \u2192 ' + r.corrigida + ' (' + r.confianca + ')');
 } else {
 erro(caso.token.padEnd(10) + ' \u2192 esperado "' + caso.esperado + '", veio "' + r.corrigida + '" (' + r.confianca + ')');
 }
});

// ============================================================
titulo('5. PIPELINE COMPLETO \u2014 MakeBlock + Fuzzy');
// ============================================================
lib.frases.forEach(function(f) {
 const blocos = MakeBlock.fazerBlocos(f);
 const analise = Fuzzy.analisarMensagem(blocos);
 console.log('\n "' + f + '"');
 analise.forEach(function(a) {
 const lego = a.tokens
 .filter(t => t.categoria !== 'desconhecido')
 .map(t => '[' + t.categoria + ': ' + t.corrigida + ']')
 .join(' + ');
 console.log(' ' + a.tipo.toUpperCase() + ' (' + a.relacao + ')');
 console.log(' ' + lego);
 });
});

// ============================================================
titulo('6. FUZZYBOSS \u2014 deducao de intencao');
// ============================================================
lib.frases.forEach(function(f) {
 const blocos = MakeBlock.fazerBlocos(f);
 const analise = Fuzzy.analisarMensagem(blocos);
 const decisoes = Boss.decidir(analise, BASE_DIR);
 console.log('\n "' + f + '"');
 decisoes.forEach(function(d) {
 const herdado = d.pistas.verbo === '(herdado)' ? ' [HERDADO]' : '';
 console.log(' [' + d.acao + '] objeto=' + (d.objeto_id || '-') + ' attr=' + (d.atributo_alvo || '-') + herdado);
 console.log(' motivo: ' + d.motivo);
 if (d.caminho_resposta) console.log(' resposta: ' + d.caminho_resposta);
 });
});

// ============================================================
titulo('7. FUZZYBOSS \u2014 heranca de verbo (soma)');
// ============================================================
lib.frasesHeranca.forEach(function(f) {
 const blocos = MakeBlock.fazerBlocos(f);
 const analise = Fuzzy.analisarMensagem(blocos);
 const decisoes = Boss.decidir(analise, BASE_DIR);
 console.log('\n "' + f + '"');
 decisoes.forEach(function(d) {
 const herdado = d.pistas.verbo === '(herdado)' ? ' [HERDADO]' : '';
 console.log(' [' + d.acao + '] verbo=' + (d.pistas.verbo || '-') + ' objeto=' + (d.objeto_id || '-') + ' attr=' + (d.atributo_alvo || '-') + herdado);
 console.log(' motivo: ' + d.motivo);
 });
});

// ============================================================
titulo('8. FUZZYBOSS \u2014 "como" ambiguo (historia vs explicacao)');
// ============================================================
lib.frasesComo.forEach(function(f) {
 const blocos = MakeBlock.fazerBlocos(f);
 const analise = Fuzzy.analisarMensagem(blocos);
 const decisoes = Boss.decidir(analise, BASE_DIR);
 console.log('\n "' + f + '"');
 decisoes.forEach(function(d) {
 console.log(' [' + d.acao + '] attr=' + (d.atributo_alvo || '-'));
 console.log(' motivo: ' + d.motivo);
 });
});

// ============================================================
titulo('9. FUZZY \u2014 palavras curtas (<=3 letras)');
// ============================================================
var curtas = ['foi', 'o', 'do', 'ai', 'me'];
curtas.forEach(function(p) {
 var r = Fuzzy.corrigirPalavra(p);
 if (r.corrigida === p) {
 ok(p + ' \u2192 ' + r.corrigida + ' (mantido)');
 } else {
 erro(p + ' \u2192 esperado "' + p + '", veio "' + r.corrigida + '"');
 }
});

// ============================================================
titulo('10. FUZZYBOSS \u2014 asserts "como" ambiguo');
// ============================================================
if (lib.comoEsperado) {
 lib.comoEsperado.forEach(function(caso) {
 var blocos = MakeBlock.fazerBlocos(caso.frase);
 var analise = Fuzzy.analisarMensagem(blocos);
 var decisoes = Boss.decidir(analise, BASE_DIR);
 var d = decisoes[0];
 if (d && d.atributo_alvo === caso.attr) {
 ok('"' + caso.frase + '" \u2192 attr=' + caso.attr);
 } else {
 erro('"' + caso.frase + '" \u2192 esperado attr=' + caso.attr + ', veio ' + (d ? d.atributo_alvo : 'null'));
 }
 });
}

// ============================================================
console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
console.log('\u2551 RESULTADO: ' + String(passou).padStart(2) + ' passou \u00b7 ' + String(falhou).padStart(2) + ' falhou' + ' '.repeat(10) + '\u2551');
console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');
