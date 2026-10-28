// ============================================================
// engine/MakeBlock/index.js
// Estágio 1 do pipeline RAG: segmentação de frases em blocos.
//
// Regra: pausa natural corta o bloco.
//   Pausas fortes: , . ? ! ;
//   Somadores: e, mais, também, tb, tbm
//     → cortam mas marcam "soma" (herda contexto do bloco anterior)
//
// Saída: array de blocos prontos pro FuzzyFuncionario.
// ============================================================

const SOMADORES = ['e', 'mais', 'tambem', 'tb', 'tbm', 'alem', 'junto'];
const PAUSAS = /[,.?!;]+/g;

/**
 * Normaliza acentos pra comparação simples.
 * "também" → "tambem"
 */
function tirarAcento(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Checa se o fragmento começa com um somador.
 * Retorna { ehSomador: true, resto: "o github" } ou { ehSomador: false }
 */
function checarSomador(fragmento) {
  const norm = tirarAcento(fragmento).trim().toLowerCase();
  for (const som of SOMADORES) {
    // "e o github" → começa com "e " (somador + espaço)
    // "mais o email" → começa com "mais "
    if (norm === som || norm.startsWith(som + ' ')) {
      const resto = fragmento.trim().substring(som.length).trim();
      return { ehSomador: true, resto };
    }
  }
  return { ehSomador: false, resto: fragmento.trim() };
}

/**
 * Segmenta a mensagem do usuário em blocos.
 *
 * @param {string} mensagem - Texto bruto do usuário.
 * @returns {Array<{texto: string, relacao: string, indice: number}>}
 *
 * Exemplo:
 *   "solta o linkedin, e o github mais o email"
 *   → [
 *       { texto: "solta o linkedin", relacao: "principal", indice: 0 },
 *       { texto: "o github",         relacao: "soma",      indice: 1 },
 *       { texto: "o email",          relacao: "soma",      indice: 2 }
 *     ]
 */
function fazerBlocos(mensagem) {
  if (!mensagem || !mensagem.trim()) return [];

  // 1. Dividir por pausas fortes
  const fragmentos = mensagem
    .split(PAUSAS)
    .map(f => f.trim())
    .filter(f => f.length > 0);

  // Se não tem pausa nenhuma, é 1 bloco só
  if (fragmentos.length === 0) return [];
  if (fragmentos.length === 1) {
    // Mesmo sem pausa, pode ter somador no meio
    return dividirPorSomador(fragmentos[0], 0);
  }

  // 2. Processar cada fragmento
  const blocos = [];
  let indice = 0;

  for (const frag of fragmentos) {
    // Cada fragmento pode ter somador interno
    const subBlocos = dividirPorSomador(frag, indice);
    for (const sb of subBlocos) {
      sb.indice = indice;
      blocos.push(sb);
      indice++;
    }
  }

  // 3. O primeiro bloco é sempre "principal"
  if (blocos.length > 0) {
    blocos[0].relacao = 'principal';
  }

  return blocos;
}

/**
 * Divide um fragmento por somadores internos.
 * "o github mais o email" → 2 blocos
 */
function dividirPorSomador(texto, indiceBase) {
  const palavras = texto.split(/\s+/);
  const blocos = [];
  let atual = [];
  let relacao = blocos.length === 0 ? 'principal' : 'soma';

  for (let i = 0; i < palavras.length; i++) {
    const norm = tirarAcento(palavras[i]).toLowerCase();

    if (SOMADORES.includes(norm)) {
      if (atual.length > 0) {
        // Somador no meio: fecha bloco atual, abre novo
        blocos.push({
          texto: atual.join(' '),
          relacao: relacao,
          indice: indiceBase + blocos.length
        });
        atual = [];
      }
      // Somador no início (após pausa) ou no meio: descarta e marca soma
      relacao = 'soma';
    } else {
      atual.push(palavras[i]);
    }
  }

  // Fecha o último bloco
  if (atual.length > 0) {
    blocos.push({
      texto: atual.join(' '),
      relacao: relacao,
      indice: indiceBase + blocos.length
    });
  }

  return blocos;
}

// --- Export (funciona em browser e Node) ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fazerBlocos };
}
