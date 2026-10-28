// ============================================================
// MOTOR RAG BROWSER v2 — 100% DINAMICO
// Le RulesWords + intencoes do objeto. Zero hardcoded.
//
// Uso:
// MotorRAG.init(lexico, fichaObjeto);
// var resultado = MotorRAG.processar(texto, dadosResposta);
//
// lexico = { verbos, interrogativos, conectores, artigos, pronomes, somadores }
// fichaObjeto = conteudo do linkedin.json (bloco "linkedin")
// dadosResposta = { link: {...}, historia: {...}, explicacao: {...} }
// ============================================================

var MotorRAG = (function() {

var lexico = null;
var ficha = null;

function tirarAcento(str) {
 return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ===================== INIT =====================
function init(lex, fichaObj) {
 lexico = lex;
 ficha = fichaObj;
 console.log('[MotorRAG] init OK. Lexico:', Object.keys(lex), '| Ficha:', fichaObj ? fichaObj.id : 'null');
}

// ===================== MAKEBLOCK =====================
function fazerBlocos(texto) {
 var norm = texto.toLowerCase().trim();
 var pausas = [',', '.', '?', '!', ';'];
 var somadores = lexico.somadores || ['e', 'mais', 'tambem'];
 var fragmentos = [];
 var atual = '';

 for (var i = 0; i < norm.length; i++) {
 if (pausas.indexOf(norm[i]) !== -1) {
 if (atual.trim()) fragmentos.push(atual.trim());
 atual = '';
 } else {
 atual += norm[i];
 }
 }
 if (atual.trim()) fragmentos.push(atual.trim());
 if (fragmentos.length === 0) return [{ indice: 0, relacao: 'principal', texto: norm }];

 // Protege posicoes que fazem parte de marcadores compostos do lexico.
 // Assim "o que e" nao e cortado no "e" (somador) porque "o que e"
 // eh marcador de interrogativo_definicao no Interrogativos.json.
 var tiposInterrogativos = (lexico.interrogativos || {}).interrogativos || {};

 var blocos = [];
 var idx = 0;
 for (var f = 0; f < fragmentos.length; f++) {
 var palavras = fragmentos[f].split(/\s+/);
 var palavrasNorm = palavras.map(tirarAcento);

 // Marca posicoes protegidas por marcadores compostos
 var protegidas = [];
 for (var subtipo in tiposInterrogativos) {
 var marcadores = tiposInterrogativos[subtipo].marcadores || [];
 for (var m = 0; m < marcadores.length; m++) {
 var partesMarcador = tirarAcento(marcadores[m]).trim().split(/\s+/);
 if (partesMarcador.length < 2) continue;
 for (var inicio = 0; inicio + partesMarcador.length <= palavrasNorm.length; inicio++) {
 var coincide = true;
 for (var k = 0; k < partesMarcador.length; k++) {
 if (palavrasNorm[inicio + k] !== partesMarcador[k]) { coincide = false; break; }
 }
 if (coincide) {
 for (var pos = 0; pos < partesMarcador.length; pos++) protegidas[inicio + pos] = true;
 }
 }
 }
 }

 var sub = [];
 var acum = '';
 for (var p = 0; p < palavras.length; p++) {
 var w = palavras[p];
 var sa = palavrasNorm[p];
 if (somadores.indexOf(sa) !== -1 && !protegidas[p] && acum.trim()) {
 sub.push(acum.trim());
 acum = '';
 } else {
 acum += (acum ? ' ' : '') + w;
 }
 }
 if (acum.trim()) sub.push(acum.trim());
 for (var s = 0; s < sub.length; s++) {
 blocos.push({ indice: idx++, relacao: (blocos.length === 0 && s === 0) ? 'principal' : 'soma', texto: sub[s] });
 }
 }
 return blocos;
}

// ===================== CLASSIFICAR TOKEN =====================
// Usa listas do lexico + radicais do Verbos.json
function classificarToken(token) {
 var t = tirarAcento(token);

 // 1. Busca exata nas listas do lexico
 var listas = {
 'artigo_definido': lexico.artigos || [],
 'pronome': lexico.pronomes || [],
 'conector_posse': (lexico.conectores.posse_m || []).concat(lexico.conectores.posse_f || []),
 'conector_interacao': lexico.conectores.interacao || [],
 'objeto_contato': ['linkedin','github','email','whatsapp','zap','telefone','celular','numero','contato','fone']
 };

 for (var cat in listas) {
 var arr = listas[cat];
 for (var i = 0; i < arr.length; i++) {
 if (tirarAcento(arr[i]) === t) return { corrigida: arr[i], categoria: cat, confianca: 1 };
 }
 }

 // 2. Verbos: busca exata nas listas
 var catsVerbo = ['verbos_entrega', 'verbos_desejo', 'verbos_comunicacao', 'verbos_saber', 'verbos_busca'];
 for (var cv = 0; cv < catsVerbo.length; cv++) {
 var nome = catsVerbo[cv];
 var tipo = nome.replace('verbos_', 'verbo_');
 var lista = lexico.verbos[nome] || [];
 for (var j = 0; j < lista.length; j++) {
 if (tirarAcento(lista[j]) === t) return { corrigida: lista[j], categoria: tipo, confianca: 1 };
 }
 }

 // 3. Verbos: busca por RADICAL (pra verbos conjugados que nao tao na lista)
 var radicais = lexico.verbos.radicais || {};
 for (var rad in radicais) {
 if (t.indexOf(rad) === 0) {
 var tipoRad = 'verbo_' + radicais[rad];
 return { corrigida: token, categoria: tipoRad, confianca: 0.7 };
 }
 }

 // 4. Interrogativos simples (palavras unicas)
 var intgSimples = ['qual','quais','como','onde','quem','quanto','quantos','quantas','quando','porque'];
 for (var k = 0; k < intgSimples.length; k++) {
 if (tirarAcento(intgSimples[k]) === t) return { corrigida: intgSimples[k], categoria: 'interrogativo', confianca: 1 };
 }

 // 5. Fuzzy em verbos (pra typos) — score separado!
 var melhorVerbo = null, melhorScoreV = 0, melhorCatV = '';
 for (var cv2 = 0; cv2 < catsVerbo.length; cv2++) {
 var nome2 = catsVerbo[cv2];
 var tipo2 = nome2.replace('verbos_', 'verbo_');
 var lista2 = lexico.verbos[nome2] || [];
 for (var n = 0; n < lista2.length; n++) {
 var s2 = similaridade(t, tirarAcento(lista2[n]));
 if (s2 > melhorScoreV) { melhorScoreV = s2; melhorVerbo = lista2[n]; melhorCatV = tipo2; }
 }
 }
 if (melhorScoreV >= 0.8) return { corrigida: melhorVerbo, categoria: melhorCatV, confianca: Math.round(melhorScoreV*100)/100 };

 // 6. Fuzzy em objetos (pra typos) — score separado!
 var objetos = listas['objeto_contato'];
 var melhorObj = null, melhorScoreO = 0;
 for (var m = 0; m < objetos.length; m++) {
 var s = similaridade(t, tirarAcento(objetos[m]));
 if (s > melhorScoreO) { melhorScoreO = s; melhorObj = objetos[m]; }
 }
 if (melhorScoreO >= 0.6) return { corrigida: melhorObj, categoria: 'objeto_contato', confianca: Math.round(melhorScoreO*100)/100 };

 return { corrigida: token, categoria: 'desconhecido', confianca: 0 };
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

// ===================== DETECTAR INTERROGATIVO COMPOSTO =====================
// Usa os marcadores do Interrogativos.json ("como foi", "por que", etc)
function detectarInterrogativoComposto(texto) {
 var norm = tirarAcento(texto);
 var intgJSON = lexico.interrogativos.interrogativos || {};
 var melhor = null;
 var melhorPrioridade = -1;
 var melhorMarcador = '';

 for (var subtipo in intgJSON) {
 var info = intgJSON[subtipo];
 var marcadores = info.marcadores || [];
 for (var m = 0; m < marcadores.length; m++) {
 var marc = tirarAcento(marcadores[m]);
 if (norm.indexOf(marc) !== -1) {
 var pri = info.prioridade || 0;
 // Marcador mais longo = mais especifico = preferido em empate
 if (pri > melhorPrioridade || (pri === melhorPrioridade && marc.length > melhorMarcador.length)) {
 melhorPrioridade = pri;
 melhor = subtipo;
 melhorMarcador = marc;
 }
 }
 }
 }

 return { subtipo: melhor, prioridade: melhorPrioridade, marcador: melhorMarcador };
}

// ===================== ANALISAR MENSAGEM =====================
function analisarMensagem(blocos) {
 return blocos.map(function(bloco) {
 var palavras = bloco.texto.split(/\s+/).filter(function(p) { return p.length > 0; });
 var tokens = palavras.map(function(p) { return classificarToken(p); });

 // Detectar tipo de frase
 var tipo = 'solicitacao';
 if (bloco.texto.indexOf('?') !== -1) tipo = 'pergunta';
 for (var i = 0; i < tokens.length; i++) {
 if (tokens[i].categoria === 'interrogativo') { tipo = 'pergunta'; break; }
 }

 // Detectar interrogativo composto ("como foi", "por que")
 var intgComposto = detectarInterrogativoComposto(bloco.texto);

 return {
 texto_original: bloco.texto,
 relacao: bloco.relacao,
 tipo: tipo,
 tokens: tokens,
 interrogativo_composto: intgComposto
 };
 });
}

// ===================== CASAR INTENCAO =====================
// Le as intencoes da ficha do objeto e casa contra os sinais detectados
function casarIntencao(sinais, intencoes) {
 var candidatas = [];

 for (var nome in intencoes) {
 var intencao = intencoes[nome];
 var acionadoPor = intencao.acionado_por;
 var modo = intencao.modo;
 if (modo === 'manual') continue; // invocado diretamente pelo motor, nao por casarIntencao
 var score = 0;

 // acionado_por pode ser array flat ou {sets:[...]}
 if (Array.isArray(acionadoPor)) {
 if (acionadoPor.length === 0 && modo === 'always') {
 candidatas.push({ nome: nome, intencao: intencao, score: intencao.prioridade || 0 });
 continue;
 }
 var matches = 0;
 for (var i = 0; i < acionadoPor.length; i++) {
 if (sinais.indexOf(acionadoPor[i]) !== -1) matches++;
 }
 if (modo === 'all' && matches === acionadoPor.length && acionadoPor.length > 0) {
 score = (intencao.prioridade || 0) + matches;
 } else if (modo === 'any' && matches > 0) {
 score = (intencao.prioridade || 0) + matches;
 }
 } else if (acionadoPor && acionadoPor.sets) {
 // any_of_sets: qualquer set que casar inteiro
 for (var s = 0; s < acionadoPor.sets.length; s++) {
 var set = acionadoPor.sets[s];
 var setSinais = set.sinais || [];
 var setMatches = 0;
 for (var j = 0; j < setSinais.length; j++) {
 if (sinais.indexOf(setSinais[j]) !== -1) setMatches++;
 }
 if (set.modo === 'all' && setMatches === setSinais.length && setSinais.length > 0) {
 score = Math.max(score, (intencao.prioridade || 0) + setMatches);
 } else if (set.modo === 'any' && setMatches > 0) {
 score = Math.max(score, (intencao.prioridade || 0) + setMatches);
 }
 }
 }

 if (score > 0) {
 candidatas.push({ nome: nome, intencao: intencao, score: score });
 }
 }

 // Ordena por score descendente
 candidatas.sort(function(a, b) { return b.score - a.score; });
 return candidatas;
}

// ===================== RESOLVER INTERROGATIVO =====================
// Consulta ficha.interrogativos[subtipo] e decide:
// - sabe_responder: true + requer_estado satisfeito → responde via atributo
// - sabe_responder: true + requer_estado falhou → aplica on_estado_fail
// - sabe_responder: false → fallback interrogativo
// - subtipo ausente na ficha → null (motor cai no fluxo normal)
function resolverInterrogativo(subtipo, ficha, dadosResposta) {
 if (!ficha || !ficha.interrogativos) return null;
 var info = ficha.interrogativos[subtipo];
 if (!info) return null;

 // sabe_responder false → fallback interrogativo
 if (!info.sabe_responder) {
 var fbInt = ficha.intencoes && ficha.intencoes.acao_fallback_interrogativo;
 return {
 acao: 'interrogativo_nao_suportado',
 atributo: '',
 resposta: fbInt ? fbInt.resposta_inline : null,
 subtipo: subtipo,
 motivo: info.motivo || ('Objeto nao sabe responder ' + subtipo)
 };
 }

 // requer_estado: se declarado, checa estado atual (v1: schema estatico, sem sessao real)
 if (info.requer_estado) {
 var estadoAtual = (ficha.estado_schema && ficha.estado_schema[info.requer_estado]) || false;
 if (!estadoAtual) {
 var politica = info.on_estado_fail || 'suggest';
 if (politica === 'bypass') {
 // segue em frente, responde
 } else if (politica === 'error') {
 return { acao: 'estado_requerido', atributo: '', resposta: 'Preciso que voce conte a historia primeiro.', subtipo: subtipo };
 } else if (politica === 'auto_run') {
 return { acao: 'auto_run_pendente', atributo: '', resposta: null, subtipo: subtipo, auto_run: 'acao_contar_historia' };
 } else {
 // suggest (padrao)
 return { acao: 'estado_sugerido', atributo: '', resposta: 'Antes de aprofundar, quer que eu conte a historia primeiro?', subtipo: subtipo };
 }
 }
 }

 // sabe_responder true → pega atributo e responde
 var attr = info.atributo;
 var resp = '';
 if (attr && dadosResposta && dadosResposta[attr]) {
 var d = dadosResposta[attr];
 if (attr === 'link') {
 resp = (d.texto || 'Toma a\u00ed:') + '\n\ud83d\udc49 ' + (d.valor || '') + '\n\n' + (d.rodape || '');
 } else {
 resp = d.texto || ('[' + attr + ' n\u00e3o carregado]');
 }
 } else if (attr && ficha.atributos && ficha.atributos[attr]) {
 resp = '[' + attr + ': arquivo n\u00e3o carregado \u2014 caminho: ' + ficha.atributos[attr].caminho_resposta + ']';
 }

 return {
 acao: 'interrogativo_respondido',
 atributo: attr || '',
 resposta: resp,
 subtipo: subtipo
 };
}

// ===================== BOSS =====================
function decidir(analise, dadosResposta) {
 var resultados = [];
 var verboPrincipal = null;
 var objetoPrincipal = null;

 for (var i = 0; i < analise.length; i++) {
 var bloco = analise[i];
 var verbo = null, objeto = null;

 for (var t = 0; t < bloco.tokens.length; t++) {
 var tok = bloco.tokens[t];
 if (tok.categoria.indexOf('verbo_') === 0 && !verbo) verbo = tok.corrigida;
 if (tok.categoria === 'objeto_contato') { if (!objeto) objeto = tok.corrigida; if (tok.corrigida === (ficha ? ficha.id : 'linkedin')) objeto = tok.corrigida; }
 }

 if (bloco.relacao === 'principal') {
 verboPrincipal = verbo;
 objetoPrincipal = objeto;
 }
 if (bloco.relacao === 'soma' && !verbo && verboPrincipal) verbo = verboPrincipal;

 var obj = objeto || objetoPrincipal;

 // Objeto nao disponivel
 if (obj && obj !== (ficha ? ficha.id : 'linkedin')) {
 resultados.push({ acao: 'objeto_nao_disponivel', atributo: '', resposta: 'Por enquanto s\u00f3 o ' + (ficha ? ficha.id : 'LinkedIn') + ' t\u00e1 liberado. \ud83d\udee0\ufe0f' });
 continue;
 }

 // Monta sinais pra casar com intencoes
 var sinais = [];
 if (verbo) {
 var catVerbo = classificarToken(verbo).categoria;
 if (catVerbo.indexOf('verbo_') === 0) sinais.push(catVerbo);
 }
 if (bloco.interrogativo_composto && bloco.interrogativo_composto.subtipo) {
 sinais.push(bloco.interrogativo_composto.subtipo);
 } else {
 for (var t2 = 0; t2 < bloco.tokens.length; t2++) {
 if (bloco.tokens[t2].categoria === 'interrogativo') {
 sinais.push('interrogativo_generico');
 }
 }
 }
 // Adiciona categorias de conectores como sinais
 for (var t3 = 0; t3 < bloco.tokens.length; t3++) {
 var c = bloco.tokens[t3].categoria;
 if (c === 'conector_posse' || c === 'artigo_definido') sinais.push(c);
 }

 // Interrogativo detectado? Tenta resolver via bloco ficha.interrogativos primeiro.
 if (bloco.interrogativo_composto && bloco.interrogativo_composto.subtipo) {
 var resolvido = resolverInterrogativo(bloco.interrogativo_composto.subtipo, ficha, dadosResposta);
 if (resolvido) {
 resultados.push(resolvido);
 continue;
 }
 }

 // Casa contra intencoes da ficha
 var intencoes = ficha ? ficha.intencoes : {};
 var candidatas = casarIntencao(sinais, intencoes);

 if (candidatas.length > 0) {
 var vencedora = candidatas[0].intencao;
 var attr = vencedora.atributo_alvo;
 var resp = '';

 // Se tem resposta_inline, usa ela
 if (vencedora.resposta_inline) {
 resp = vencedora.resposta_inline;
 }
 // Se tem atributo_alvo, busca nos dados de resposta
 else if (attr && dadosResposta[attr]) {
 var d = dadosResposta[attr];
 if (attr === 'link') {
 resp = (d.texto || 'Toma a\u00ed:') + '\n\ud83d\udc49 ' + (d.valor || '') + '\n\n' + (d.rodape || '');
 } else {
 resp = d.texto || ('[' + attr + ' n\u00e3o carregado]');
 }
 }
 // Se tem caminho_resposta na ficha, tenta buscar
 else if (attr && ficha.atributos && ficha.atributos[attr]) {
 resp = '[' + attr + ': arquivo n\u00e3o carregado \u2014 caminho: ' + ficha.atributos[attr].caminho_resposta + ']';
 }

 // Se a inten\u00e7\u00e3o declara complemento_atributo, anexa resposta do complemento no fim
 if (vencedora.complemento_atributo && dadosResposta[vencedora.complemento_atributo]) {
 var cAttr = vencedora.complemento_atributo;
 var cd = dadosResposta[cAttr];
 var cTexto = '';
 if (cAttr === 'link') {
 cTexto = (cd.texto || 'Toma a\u00ed:') + '\n\ud83d\udc49 ' + (cd.valor || '') + '\n\n' + (cd.rodape || '');
 } else {
 cTexto = cd.texto || '';
 }
 if (cTexto) resp = resp + '\n\n---\n\n' + cTexto;
 }

 resultados.push({
 acao: candidatas[0].nome,
 atributo: attr || '',
 resposta: resp || 'Entendi o que voc\u00ea quer, mas ainda n\u00e3o tenho essa resposta pronta. \ud83d\udee0\ufe0f'
 });
 } else {
 // Fallback
 var fallback = intencoes.acao_fallback;
 resultados.push({
 acao: 'fallback',
 atributo: '',
 resposta: fallback ? fallback.resposta_inline : 'N\u00e3o entendi. Tenta pedir o link, a hist\u00f3ria ou perguntar sobre o ' + (ficha ? ficha.id : 'LinkedIn') + '! \ud83e\udd86'
 });
 }
 }

 return resultados;
}

// ===================== PROCESSAR =====================
function processar(texto, dadosResposta) {
 var blocos = fazerBlocos(texto);
 var analise = analisarMensagem(blocos);
 var decisoes = decidir(analise, dadosResposta);

 var partes = [];
 for (var i = 0; i < decisoes.length; i++) {
 if (decisoes[i].resposta) partes.push(decisoes[i].resposta);
 }

 return {
 texto: partes.join('\n\n---\n\n') || 'Hmm, n\u00e3o entendi. \ud83e\udd86',
 decisoes: decisoes,
 analise: analise
 };
}

return {
 init: init,
 fazerBlocos: fazerBlocos,
 analisarMensagem: analisarMensagem,
 decidir: decidir,
 processar: processar,
 classificarToken: classificarToken,
 detectarInterrogativoComposto: detectarInterrogativoComposto,
 resolverInterrogativo: resolverInterrogativo
};

})();
