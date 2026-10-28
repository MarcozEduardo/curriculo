// ============================================================
// CHAT RAG PILOTO v3 — Motor 100% DINAMICO
// Carrega RulesWords + linkedin.json. Zero hardcoded.
// ============================================================

const BASE_OBJ = 'Orbitas/Contato/Objetos/LinkedIn';
const BASE_RULES = 'RulesWords';

let dados = {};
let lexico = {};

async function carregarJSON(caminho) {
  try {
    const r = await fetch(caminho + '?t=' + Date.now());
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function init() {
  // 1. Carregar RulesWords (lexico)
  const [verbos, interrogativos, conectores, artigos, pronomes, somadores] = await Promise.all([
    carregarJSON(BASE_RULES + '/Verbos.json'),
    carregarJSON(BASE_RULES + '/Interrogativos.json'),
    carregarJSON(BASE_RULES + '/Conectores.json'),
    carregarJSON(BASE_RULES + '/Artigos.json'),
    carregarJSON(BASE_RULES + '/Pronomes.json'),
    carregarJSON(BASE_RULES + '/Somadores.json')
  ]);

  // Extrai arrays dos JSONs (cada arquivo tem chaves diferentes)
  function juntar(obj) {
    if (!obj) return [];
    var arr = [];
    for (var k in obj) {
      if (k === '_meta') continue;
      if (Array.isArray(obj[k])) arr = arr.concat(obj[k]);
    }
    return arr;
  }

  lexico = {
    verbos: verbos || {},
    interrogativos: interrogativos || {},
    conectores: conectores || {},
    artigos: juntar(artigos),
    pronomes: juntar(pronomes),
    somadores: juntar(somadores)
  };

  // 2. Carregar ficha do objeto + dados de resposta
  const fichaCompleta = await carregarJSON(BASE_OBJ + '/linkedin.json');
  dados.ficha = fichaCompleta ? fichaCompleta.linkedin : null;
  dados.link = await carregarJSON(BASE_OBJ + '/Link.json');
  dados.historia = await carregarJSON(BASE_OBJ + '/Historia.json');
  dados.explicacao = await carregarJSON(BASE_OBJ + '/Explicacao.json');
 dados.definicao = await carregarJSON(BASE_OBJ + '/Definition.json');
 dados.dinamica = await carregarJSON(BASE_OBJ + '/Dinamica.json');
 dados.execucao = await carregarJSON(BASE_OBJ + '/Execucao.json');
 dados.quantidade = await carregarJSON(BASE_OBJ + '/Quantidade.json');

  // 3. Inicializar motor
  MotorRAG.init(lexico, dados.ficha);

  const ok = dados.ficha && dados.link && dados.historia;
  addMsg('bot',
    'E a\u00ed! Sou o assistente do curr\u00edculo do Marcos. ' +
    (ok ? '(motor din\u00e2mico pronto \u2705)' : '(aviso: faltou carregar algo)') +
    '\n\nPor enquanto s\u00f3 tenho o LinkedIn liberado. Pode pedir o link, a hist\u00f3ria ou perguntar sobre ele. Manda ver! \ud83e\udd86'
  );

  console.log('[Chat] Lexico carregado:', lexico);
  console.log('[Chat] Ficha:', dados.ficha ? dados.ficha.id : 'null');
  console.log('[Chat] Intencoes:', dados.ficha ? Object.keys(dados.ficha.intencoes) : 'null');
}

// --- UI ---
const log = document.getElementById('chat-log');
const input = document.getElementById('user-input');
const btn = document.getElementById('btn-send');

function addMsg(tipo, texto) {
  const div = document.createElement('div');
  div.className = 'msg ' + tipo;
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = tipo === 'bot' ? '\ud83e\udd16 Assistente' : '\ud83d\udc64 Voc\u00ea';
  div.appendChild(label);
  div.appendChild(document.createTextNode(texto));
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function logPipeline(texto, resultado) {
  console.group('[Pipeline] "' + texto + '"');
  console.log('analise:', resultado.analise);
  console.log('decisoes:', resultado.decisoes);
  console.groupEnd();
}

function enviar() {
  const texto = input.value.trim();
  if (!texto) return;
  addMsg('user', texto);
  input.value = '';
  setTimeout(() => processar(texto), 300);
}

btn.addEventListener('click', enviar);
input.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });

// --- PROCESSAMENTO ---
function processar(texto) {
  // dadosResposta mapeia atributo -> JSON de resposta
  var dadosResposta = {
    link: dados.link,
    historia: dados.historia,
    explicacao_da_historia: dados.explicacao,
    definicao: dados.definicao,
 dinamica: dados.dinamica,
 execucao: dados.execucao,
 quantidade: dados.quantidade
  };

  const resultado = MotorRAG.processar(texto, dadosResposta);
  logPipeline(texto, resultado);
  addMsg('bot', resultado.texto);
}

// --- BOOT ---
init();
