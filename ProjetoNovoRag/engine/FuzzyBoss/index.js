// ============================================================
// engine/FuzzyBoss/index.js
// Estágio 3 do pipeline RAG: dedução de intenção por tipo.
//
// Recebe o array-lego do FuzzyFuncionario, carrega a ficha do
// objeto e deduz O QUE entregar pela compatibilidade de tipos.
//
// Lógica central:
//   verbo_entrega    → atributo tipo "entregavel"
//   verbo_explicacao → atributo tipo "explicavel"
//   interrogativo    → atributo apontado no bloco interrogativos
//   verbo_desejo     → depende do objeto (fallback inteligente)
// ============================================================

const fs = require('fs');
const path = require('path');

// Mapeamento: categoria do verbo → tipo de atributo esperado
const MAPA_TIPO = {
  'verbo_entrega': 'entregavel',
  'verbo_explicacao': 'explicavel',
  'verbo_comunicacao': 'explicavel',
  'verbo_busca': 'entregavel'
};

// Mapeamento: interrogativo → campo no bloco interrogativos do objeto
const MAPA_INTERROGATIVO = {
  'interrogativo': 'interrogativo_definicao',  // genérico
  'qual': 'interrogativo_definicao',
  'o que': 'interrogativo_definicao',
  'por que': 'interrogativo_explicacao',
  'porque': 'interrogativo_explicacao',
  'quando': 'interrogativo_historia',
  'onde': 'interrogativo_local',
  'quem': 'interrogativo_pessoa',
  'quanto': 'interrogativo_quantidade'
};

// Palavras que indicam PASSADO (história) vs PRESENTE (explicação)
const PALAVRAS_PASSADO = ['foi', 'comecou', 'surgiu', 'aconteceu', 'criou', 'nasceu', 'comecava', 'era'];
const PALAVRAS_PRESENTE = ['funciona', 'faz', 'e', 'serve', 'ajuda', 'trabalha'];

/**
 * Resolve "como" ambíguo: olha o contexto da frase.
 * "como foi" → história | "como funciona" → explicação
 */
function resolverComo(tokens) {
  for (const t of tokens) {
    const norm = t.corrigida.toLowerCase();
    if (PALAVRAS_PASSADO.indexOf(norm) !== -1) return 'interrogativo_historia';
    if (PALAVRAS_PRESENTE.indexOf(norm) !== -1) return 'interrogativo_explicacao';
  }
  // Default: se não tem pista, é explicação
  return 'interrogativo_explicacao';
}

// Cache de fichas carregadas
const cache = {};

/**
 * Carrega a ficha do objeto do disco.
 * @param {string} ancora - Nome da pasta (ex: "Contato")
 * @param {string} objetoId - ID do objeto (ex: "linkedin")
 * @param {string} baseDir - Caminho base do projeto
 */
function carregarFicha(ancora, objetoId, baseDir) {
  const chave = ancora + '/' + objetoId;
  if (cache[chave]) return cache[chave];

  // 1. Tenta caminhos diretos
  const candidatos = [
    path.join(baseDir, 'Orbitas', ancora, 'Objetos', capitalize(objetoId), objetoId + '.json'),
    path.join(baseDir, 'Orbitas', ancora, 'Objetos', objetoId, objetoId + '.json')
  ];

  for (const caminho of candidatos) {
    try {
      const raw = fs.readFileSync(caminho, 'utf8');
      const ficha = JSON.parse(raw);
      cache[chave] = ficha;
      return ficha;
    } catch (e) {
      // tenta próximo
    }
  }

  // 2. Fallback: lista pasta Objetos/ e busca case-insensitive
  const pastaObjetos = path.join(baseDir, 'Orbitas', ancora, 'Objetos');
  try {
    const dirs = fs.readdirSync(pastaObjetos);
    const match = dirs.find(d => d.toLowerCase() === objetoId.toLowerCase());
    if (match) {
      const caminho = path.join(pastaObjetos, match, objetoId + '.json');
      const raw = fs.readFileSync(caminho, 'utf8');
      const ficha = JSON.parse(raw);
      cache[chave] = ficha;
      return ficha;
    }
  } catch (e) {
    // pasta não existe
  }

  return null;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Extrai informações do array-lego de um bloco.
 */
function extrairPistas(tokens) {
  const pistas = {
    verbo: null,
    verboCategoria: null,
    artigo: null,
    objeto: null,
    objetoCategoria: null,
    interrogativo: null,
    posse: null,
    tipo: 'solicitacao'
  };

  for (const t of tokens) {
    if (t.categoria.startsWith('verbo_') && !pistas.verbo) {
      pistas.verbo = t.corrigida;
      pistas.verboCategoria = t.categoria;
    }
    if (t.categoria === 'artigo_definido' && !pistas.artigo) {
      pistas.artigo = t.corrigida;
    }
    if (t.categoria.startsWith('objeto_') && !pistas.objeto) {
      pistas.objeto = t.corrigida;
      pistas.objetoCategoria = t.categoria;
    }
    if (t.categoria === 'interrogativo' && !pistas.interrogativo) {
      pistas.interrogativo = t.corrigida;
    }
    if (t.categoria === 'conector_posse' && !pistas.posse) {
      pistas.posse = t.corrigida;
    }
  }

  return pistas;
}

/**
 * Herança de verbo para blocos soma.
 * Regra: só herda se o objeto do soma for da MESMA órbita (categoria) que o principal.
 *
 * @param {Array} analise - Todos os blocos analisados
 * @returns {Array} analise com verbos herdados nos blocos soma
 */
function aplicarHeranca(analise) {
  if (analise.length <= 1) return analise;

  // Acha o bloco principal e sua órbita
  const principal = analise.find(b => b.relacao === 'principal');
  if (!principal) return analise;

  const pistasPrincipal = extrairPistas(principal.tokens);
  const orbitaPrincipal = pistasPrincipal.objetoCategoria; // ex: "objeto_contato"
  const verboPrincipal = pistasPrincipal.verbo;
  const verboCatPrincipal = pistasPrincipal.verboCategoria;

  if (!verboPrincipal || !orbitaPrincipal) return analise;

  // Aplica herança nos blocos soma
  for (const bloco of analise) {
    if (bloco.relacao !== 'soma') continue;

    const pistas = extrairPistas(bloco.tokens);

    // Já tem verbo próprio? Não herda.
    if (pistas.verbo) continue;

    // Mesma órbita? Herda o verbo do principal.
    if (pistas.objetoCategoria === orbitaPrincipal) {
      // Injeta o verbo herdado nos tokens do bloco
      bloco.tokens.unshift({
        original: '(herdado)',
        corrigida: verboPrincipal,
        categoria: verboCatPrincipal,
        confianca: 1,
        status: 'herdado'
      });
      bloco.verbo_herdado = true;
    }
    // Órbita diferente? Não herda. Bloco fica sem verbo (objeto_solto).
  }

  return analise;
}

/**
 * Decisão principal do FuzzyBoss.
 *
 * @param {Array} analise - Resultado do FuzzyFuncionario.analisarMensagem()
 * @param {string} baseDir - Caminho base do projeto
 * @returns {Array} Decisões por bloco
 */
function decidir(analise, baseDir) {
  // Aplica herança de verbo antes de decidir
  analise = aplicarHeranca(analise);

  const decisoes = [];

  for (const bloco of analise) {
    const pistas = extrairPistas(bloco.tokens);
    const decisao = {
      bloco: bloco.texto_original,
      relacao: bloco.relacao,
      tipo_frase: bloco.tipo,
      pistas: pistas,
      acao: null,
      objeto_id: null,
      atributo_alvo: null,
      caminho_resposta: null,
      motivo: ''
    };

    // 1. Sem objeto = não sei o que fazer
    if (!pistas.objeto) {
      decisao.acao = 'fallback';
      decisao.motivo = 'Nenhum objeto identificado no bloco.';
      decisoes.push(decisao);
      continue;
    }

    // 2. Extrai âncora da categoria (objeto_contato → Contato)
    const ancora = pistas.objetoCategoria.replace('objeto_', '');
    const ancoraCapitalizada = capitalize(ancora);

    // 3. Carrega ficha do objeto
    const ficha = carregarFicha(ancoraCapitalizada, pistas.objeto, baseDir);
    if (!ficha) {
      // Objeto não tem ficha ainda (ex: github, email, zap)
      decisao.acao = 'objeto_nao_disponivel';
      decisao.objeto_id = pistas.objeto;
      decisao.motivo = 'Objeto "' + pistas.objeto + '" reconhecido mas sem ficha em Orbitas/' + ancoraCapitalizada + '/. Ainda em construção.';
      decisoes.push(decisao);
      continue;
    }

    // 4. Pega os dados do objeto dentro da ficha
    const objData = ficha[pistas.objeto] || ficha;
    decisao.objeto_id = pistas.objeto;

    // 5. Verifica posse (cascata simples)
    if (pistas.posse && objData.hierarquia) {
      const pertence = objData.hierarquia['pertence_ao_marcos'];
      if (!pertence) {
        decisao.acao = 'posse_negada';
        decisao.motivo = 'Objeto não pertence ao sujeito indicado.';
        decisoes.push(decisao);
        continue;
      }
    }

    // 6. DEDUÇÃO POR TIPO
    const atributos = objData.atributos || {};

    // 6a. Interrogativo → consulta bloco interrogativos
    if (pistas.interrogativo) {
      // "como" é ambíguo: resolve pelo contexto da frase
      let tipoInterrogativo;
      if (pistas.interrogativo === 'como') {
        tipoInterrogativo = resolverComo(bloco.tokens);
      } else {
        tipoInterrogativo = MAPA_INTERROGATIVO[pistas.interrogativo] || 'interrogativo_definicao';
      }
      const interrogativos = objData.interrogativos || {};
      const info = interrogativos[tipoInterrogativo];

      if (info && info.sabe_responder) {
        const attrNome = info.atributo;
        const attr = atributos[attrNome];
        if (attr) {
          decisao.acao = 'responder_interrogativo';
          decisao.atributo_alvo = attrNome;
          decisao.caminho_resposta = attr.caminho_resposta;
          decisao.motivo = 'Interrogativo "' + pistas.interrogativo + '" → ' + tipoInterrogativo + ' → atributo "' + attrNome + '"';
        } else {
          decisao.acao = 'atributo_ausente';
          decisao.motivo = 'Interrogativo aponta pra "' + attrNome + '" mas atributo não existe na ficha.';
        }
      } else {
        decisao.acao = 'interrogativo_nao_suportado';
        decisao.motivo = 'Objeto não sabe responder ' + tipoInterrogativo + '.';
      }
      decisoes.push(decisao);
      continue;
    }

    // 6b. Verbo → deduz tipo de atributo
    if (pistas.verboCategoria) {
      const tipoEsperado = MAPA_TIPO[pistas.verboCategoria];

      if (tipoEsperado) {
        // Filtra atributos que batem com o tipo
        const compativeis = [];
        for (const nome in atributos) {
          if (atributos[nome].tipo === tipoEsperado) {
            compativeis.push(nome);
          }
        }

        if (compativeis.length === 1) {
          // Único compatível = dedução direta
          const attrNome = compativeis[0];
          decisao.acao = 'entrega_deduzida';
          decisao.atributo_alvo = attrNome;
          decisao.caminho_resposta = atributos[attrNome].caminho_resposta;
          decisao.motivo = 'Verbo "' + pistas.verbo + '" (' + pistas.verboCategoria + ') → tipo "' + tipoEsperado + '" → único atributo: "' + attrNome + '"';
        } else if (compativeis.length > 1) {
          // Múltiplos = ambiguidade, pega o primeiro por prioridade
          decisao.acao = 'entrega_ambigua';
          decisao.atributo_alvo = compativeis[0];
          decisao.caminho_resposta = atributos[compativeis[0]].caminho_resposta;
          decisao.motivo = 'Verbo "' + pistas.verbo + '" → ' + compativeis.length + ' atributos ' + tipoEsperado + ': ' + compativeis.join(', ') + '. Usando primeiro.';
        } else {
          decisao.acao = 'sem_atributo_compativel';
          decisao.motivo = 'Verbo "' + pistas.verbo + '" quer tipo "' + tipoEsperado + '" mas objeto só tem: ' + Object.keys(atributos).map(n => n + '(' + atributos[n].tipo + ')').join(', ');
        }
      } else {
        decisao.acao = 'verbo_sem_mapa';
        decisao.motivo = 'Categoria "' + pistas.verboCategoria + '" não tem mapeamento de tipo ainda.';
      }
    } else {
      // Sem verbo e sem interrogativo = objeto solto
      decisao.acao = 'objeto_solto';
      decisao.motivo = 'Objeto "' + pistas.objeto + '" sem verbo ou interrogativo. Oferecer opções.';
    }

    decisoes.push(decisao);
  }

  return decisoes;
}

// --- Export ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { decidir: decidir, extrairPistas: extrairPistas };
}
