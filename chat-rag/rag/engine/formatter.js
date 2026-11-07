/**
 * RAGFormatter - organiza a resposta em blocos visuais.
 *
 * Bloco 1: prefixo (saudacao horaria, revisit "Retomando...")
 * Bloco 2: abertura A ("Vou ser direto:" / "Entao, e o seguinte:") em linha propria + corpo
 * Bloco 3: oferta de continuidade
 *
 * Separador entre blocos: linha em branco (\n\n).
 * Separador entre abertura A e corpo: linha simples (\n).
 * Aberturas curtas do humanizer ("Claro.", "Beleza.") sao removidas do inicio do corpo.
 */

const ABERTURAS_A = [
  'Vou ser direto com você', 'Vou ser direto com voce',
  'Então, é o seguinte', 'Entao, e o seguinte',
  'Sem enrolação', 'Sem enrolacao',
  'Olha, é o seguinte', 'Olha, e o seguinte',
  'É assim olha', 'E assim olha'
];

const ABERTURAS_HUMANIZER = [
  'Claro.', 'Beleza.', 'Show.', 'Certo.', 'Entendi.', 'Boa pergunta.',
  'Boa.', 'Perfeito.', 'Fechado.', 'Ok.', 'Tudo bem.', 'Bom.', 'Legal.',
  'Bacana.', 'Beleza então.', 'Sem problema.', 'Com certeza.', 'Pois é.',
  'Pode crer.', 'Combinado.', 'Firmado.', 'Sem dúvida.', 'Sem duvida.'
];

function _norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function removerAberturaCurta(text) {
  let t = String(text || '').trim();
  for (const a of ABERTURAS_HUMANIZER) {
    const aN = _norm(a);
    const tN = _norm(t);
    if (tN === aN) return '';
    if (tN.startsWith(aN + ' ')) return t.slice(a.length + 1).trim();
    if (tN.startsWith(aN + String.fromCharCode(10))) return t.slice(a.length + 1).trim();
  }
  return t;
}

function separarAberturaA(text) {
  const t = String(text || '').trim();
  if (!t) return { abertura: null, corpo: '' };
  const tN = _norm(t);
  for (const a of ABERTURAS_A) {
    const aN = _norm(a);
    if (tN.startsWith(aN + ':')) {
      const idx = t.indexOf(':');
      if (idx > 0 && idx < 80) {
        return {
          abertura: t.slice(0, idx + 1).trim(),
          corpo: t.slice(idx + 1).trim()
        };
      }
    }
  }
  return { abertura: null, corpo: t };
}

function format({ prefix, body, offer }) {
  const NL = String.fromCharCode(10);
  const NL2 = NL + NL;
  const blocos = [];

  const p = String(prefix || '').trim();
  if (p) blocos.push(p);

  const bLimpo = removerAberturaCurta(body);
  const sep = separarAberturaA(bLimpo);
  if (sep.abertura) {
    blocos.push(sep.abertura + NL + sep.corpo);
  } else if (sep.corpo) {
    blocos.push(sep.corpo);
  }

  const o = String(offer || '').trim();
  if (o) blocos.push(o);

  return blocos.join(NL2);
}

if (typeof window !== 'undefined') window.RAGFormatter = { format, separarAberturaA, removerAberturaCurta };
if (typeof module !== 'undefined' && module.exports) module.exports = { format, separarAberturaA, removerAberturaCurta };
