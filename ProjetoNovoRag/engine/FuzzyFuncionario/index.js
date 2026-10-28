// ============================================================
// engine/FuzzyFuncionario/index.js
// Estágio 2 do pipeline RAG: correção de palavras + categorização.
//
// Recebe um bloco do MakeBlock, separa em tokens, corrige cada
// token por similaridade (letras na ordem + tamanho proporcional)
// e marca a categoria gramatical.
//
// NÃO usa regex. NÃO usa tabela de typos. É pura comparação.
// ============================================================

// --- VOCABULÁRIO BASE (mínimo pra funcionar) ---
// Futuro: carregar dinamicamente dos RulesWords/*.json
const VOCABULARIO = {
  verbo_entrega: ['manda','mandar','mando','passa','passar','passo','envia','enviar','solta','soltar','cola','colar','joga','jogar','descola','mostra','mostrar'],
  verbo_desejo: ['quero','quer','queria','preciso','precisa','poderia','pode','posso','gostaria'],
  verbo_comunicacao: ['fala','falar','fale','falo','conta','contar','chama','chamar','liga','ligar','informa','informar'],
  verbo_busca: ['acho','achar','encontro','encontrar','chego','chegar','vejo','ver','consigo','conseguir'],
  artigo_definido: ['o','os','a','as','um','uma'],
  conector_posse: ['do','da','de','dele','dela','dos','das'],
  conector_interacao: ['com','pro','pra','para','em','no','na','ao'],
  interrogativo: ['qual','quais','como','onde','quem','quanto','quantos','quantas','quando','porque'],
  pronome: ['eu','me','mim','ele','ela','dele','dela','nos','voce','te','ti'],
  objeto_contato: ['link','linkedin','github','email','whatsapp','zap','telefone','celular','numero','contato','contatinho','fone'],
  adverbio: ['ai','aí','aqui','ali','la','lá','agora','ja','já','so','só','bem','muito','mais','menos']
};

// Marcadores de pergunta (frases que começam com isso são perguntas)
const MARCADORES_PERGUNTA = ['o que','qual','quais','como','onde','quem','quanto','quando','por que','porque'];

function tirarAcento(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ============================================================
// ALGORITMO DE SIMILARIDADE
//
// Regra: as letras do TOKEN precisam aparecer na CANDIDATA
// na mesma ordem (subsequência). Se o token é MAIOR que a
// candidata, é OVERWRITE (não pode ser aquela palavra).
//
// Score = (letras encontradas / letras do token) * (tamanho token / tamanho candidata)
// ============================================================
function similaridade(token, candidata) {
  var t = tirarAcento(token);
  var c = tirarAcento(candidata);

  // Overwrite: token maior que candidata = impossível
  if (t.length > c.length) return 0;

  // Match exato = perfeição
  if (t === c) return 1;

  // Subsequência: letras do token na ordem em candidata
  var ti = 0;
  for (var ci = 0; ci < c.length && ti < t.length; ci++) {
    if (c[ci] === t[ti]) ti++;
  }

  // Nenhuma letra bateu
  if (ti === 0) return 0;

  // Token curto (<=3 letras): exige cobertura total, senão vira outra palavra
  if (t.length <= 3 && ti < t.length) return 0;

  // Score: cobertura de letras * proporção de tamanho
  var cobertura = ti / t.length;       // 1.0 se todas as letras do token foram achadas
  var proporcao = t.length / c.length;  // 1.0 se mesmo tamanho, menor se candidata é maior

  return cobertura * proporcao;
}

// ============================================================
// CORRIGE UMA PALAVRA
// Busca no vocabulário a palavra mais similar.
// Retorna { corrigida, categoria, confianca, original }
// ============================================================
function corrigirPalavra(token) {
  var melhor = null;
  var melhorScore = 0;
  var melhorCategoria = 'desconhecido';

  for (var categoria in VOCABULARIO) {
    var palavras = VOCABULARIO[categoria];
    for (var i = 0; i < palavras.length; i++) {
      var score = similaridade(token, palavras[i]);
      if (score > melhorScore) {
        melhorScore = score;
        melhor = palavras[i];
        melhorCategoria = categoria;
      }
    }
  }

  // Threshold de confiança: abaixo de 0.4 = não entendi
  if (melhorScore < 0.4) {
    return {
      original: token,
      corrigida: token,
      categoria: 'desconhecido',
      confianca: melhorScore,
      status: 'nao_entendi'
    };
  }

  return {
    original: token,
    corrigida: melhor,
    categoria: melhorCategoria,
    confianca: Math.round(melhorScore * 100) / 100,
    status: melhorScore >= 0.9 ? 'exato' : 'corrigido'
  };
}

// ============================================================
// DETECTA TIPO DE FRASE
// pergunta vs solicitação
// ============================================================
function detectarTipoFrase(texto, tokens) {
  var norm = tirarAcento(texto).trim();

  // Tem ponto de interrogação = pergunta
  if (texto.indexOf('?') !== -1) return 'pergunta';

  // Começa com marcador de pergunta
  for (var i = 0; i < MARCADORES_PERGUNTA.length; i++) {
    if (norm.indexOf(MARCADORES_PERGUNTA[i]) === 0) return 'pergunta';
  }

  // Tem interrogativo no meio ("me diz qual é")
  for (var j = 0; j < tokens.length; j++) {
    if (tokens[j].categoria === 'interrogativo') return 'pergunta';
  }

  return 'solicitacao';
}

// ============================================================
// FUNÇÃO PRINCIPAL
// Recebe um bloco do MakeBlock, devolve tokens categorizados.
// ============================================================
function analisarBloco(bloco) {
  if (!bloco || !bloco.texto) return { tokens: [], tipo: 'solicitacao' };

  var palavras = bloco.texto.split(/\s+/).filter(function(p) { return p.length > 0; });
  var tokens = [];

  for (var i = 0; i < palavras.length; i++) {
    var resultado = corrigirPalavra(palavras[i]);
    tokens.push(resultado);
  }

  var tipo = detectarTipoFrase(bloco.texto, tokens);

  return {
    texto_original: bloco.texto,
    relacao: bloco.relacao || 'principal',
    tipo: tipo,
    tokens: tokens
  };
}

// ============================================================
// ANALISA MENSAGEM COMPLETA (todos os blocos)
// ============================================================
function analisarMensagem(blocos) {
  var resultados = [];
  for (var i = 0; i < blocos.length; i++) {
    resultados.push(analisarBloco(blocos[i]));
  }
  return resultados;
}

// --- Export ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { analisarBloco: analisarBloco, analisarMensagem: analisarMensagem, similaridade: similaridade, corrigirPalavra: corrigirPalavra };
}
