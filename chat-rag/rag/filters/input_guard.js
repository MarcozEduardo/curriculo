/**
 * InputGuard - higiene da entrada do visitante.
 * Bloqueia, antes de qualquer busca:
 *  - repetição exagerada de letras (fora de risadas como kkkk, hahaha, rsrsrs)
 *  - sequências longas do mesmo dígito (666666 passa; 6666666 não) e blocos numéricos enormes
 *  - código-fonte, SQL, HTML/script ou comandos colados
 *  - tentativas de reprogramar o assistente pelo chat
 *  - mensagens longas demais
 * Dep: rag/responses/input_guard.json (textos de resposta).
 */
class InputGuard {
  constructor() {
    this.responses = {};
    this.limits = { maxLength: 500, sameCharRun: 6, sameDigitRun: 6, digitBlock: 18, patternRepeat: 4 };
  }

  async init() {
    try {
      const res = await fetch(window.RAG_URL("rag/responses/input_guard.json"));
      this.responses = await res.json();
    } catch (e) {
      this.responses = {};
    }
  }

  /** Remove risadas aceitas para que não contem como repetição abusiva. */
  stripLaughs(text) {
    return text
      .replace(/\b(?:k{2,}|(?:ha){2,}h?|(?:he){2,}h?|(?:hi){2,}h?|(?:hu){2,}h?|(?:rs){2,}r?|(?:ja){2,}j?|(?:ka){2,}|(?:kk)+|lol|ksks(?:ks)*)\b/gi, " ")
      .replace(/[!?.]{2,}/g, " ");
  }

  looksLikeCode(text) {
    // Padrões inequívocos de ataque ou código executável: bloqueiam sozinhos.
    if (/<\s*script|<\s*iframe|<\?php|\bDROP\s+TABLE\b|\bUNION\s+SELECT\b|\brm\s+-rf\b|\beval\(|document\.cookie|onerror\s*=/i.test(text)) return true;
    let score = 0;
    const checks = [
      /\b(function|const|let|var|return|import|export|class|async|await|def|elif|lambda|print|console\.log|document\.|window\.|require\(|module\.exports|public\s+static|System\.out|#include|using\s+namespace)\b/i,
      /\bSELECT\b[\s\S]{0,80}\bFROM\b|\bINSERT\s+INTO\b|\bDROP\s+TABLE\b|\bUNION\s+SELECT\b|\bDELETE\s+FROM\b|\bUPDATE\b[\s\S]{0,60}\bSET\b/i,
      /<\s*script|<\/?[a-z][a-z0-9-]*(\s+[a-z-]+=["'][^"']*["'])*\s*\/?>|<\?php/i,
      /=>|===|!==|\+\+|--|&&|\|\||::|->/,
      /[{};]\s*$|^\s*[{}]\s*$/m,
      /\$\(|\beval\(|\bexec\(|\bos\.system|\bsubprocess|\brm\s+-rf\b|\bcurl\s+https?:|\bwget\s+https?:|\bbase64\b|\\x[0-9a-f]{2}|\bchmod\b|\bsudo\b/i,
      /^\s*(\/\/|#!|\/\*|\*\/|--\s)/m,
    ];
    for (const rx of checks) if (rx.test(text)) score += 1;

    const symbols = (text.match(/[{}()[\];<>=$|\\`]/g) || []).length;
    if (text.length > 40 && symbols / text.length > 0.08) score += 1;
    if ((text.match(/\n/g) || []).length >= 3 && symbols >= 4) score += 1;

    return score >= 2;
  }

  /** Fração do texto ocupada por "material de código" (símbolos densos). */
  codeShare(text) {
    const symbols = (text.match(/[{}()[\];<>=$|\\`]/g) || []).length;
    const newlines = (text.match(/\n/g) || []).length;
    let dense = symbols + newlines * 2;
    return Math.min(1, dense / Math.max(1, text.length));
  }

  looksLikeInjection(text) {
    return /(ignore|esque[cç]a|desconsidere|apague|anule)\s+(todas\s+|as\s+|suas\s+|seu\s+)*(instru[cç][oõ]es|regras|prompt|diretrizes|configura[cç][aã]o)|system\s*prompt|voc[eê]\s+agora\s+(é|e|vai ser|sera)\b|finja\s+que\b|a partir de agora voc[eê]|jailbreak|act\s+as\b|you\s+are\s+now\b|ignore\s+(all\s+)?previous/i.test(text);
  }

  /**
   * @returns {{ok:true}|{ok:false, reason:string, variations:string[]}}
   */
  check(rawText) {
    const text = String(rawText || "");
    const trimmed = text.trim();
    if (!trimmed) return { ok: true };

    if (trimmed.length > this.limits.maxLength) return this.block("too_long");
    if (this.looksLikeInjection(trimmed)) return this.block("injection");

    // Código colado: bloqueia quando o código predomina. Mas se o recrutador
    // cola um trecho curto JUNTO de uma pergunta ("o que esse código faz?"),
    // deixamos passar para o fluxo normal (que vai explicar ou admitir a lacuna).
    if (this.looksLikeCode(trimmed)) {
      const looksLikeQuestion = /\?\s*$/.test(trimmed) || /^(o que|qual|quais|como|por que|porque|esse|essa|este|pra que|explica|esse codigo|me explica|what|why|how)\b/i.test(trimmed);
      const codeShare = this.codeShare(trimmed);
      if (!looksLikeQuestion || codeShare > 0.5) return this.block("code");
    }

    const digitRun = new RegExp(`(\\d)\\1{${this.limits.sameDigitRun},}`);
    if (digitRun.test(trimmed) || new RegExp(`\\d{${this.limits.digitBlock},}`).test(trimmed.replace(/[\s().-]/g, ""))) {
      return this.block("numbers");
    }

    const noLaughs = this.stripLaughs(trimmed.toLowerCase());
    const charRun = new RegExp(`([^\\d\\s])\\1{${this.limits.sameCharRun},}`);
    const patternRun = new RegExp(`(.{2,4}?)\\1{${this.limits.patternRepeat},}`);
    if (charRun.test(noLaughs) || patternRun.test(noLaughs.replace(/\s+/g, ""))) {
      return this.block("repetition");
    }

    // Só risada/pontuação, sem conteúdo: deixamos passar para o small talk.
    return { ok: true };
  }

  block(reason) {
    const list = (this.responses && this.responses[reason]) || ["Não consegui tratar essa mensagem. Pode reformular a pergunta?"];
    return { ok: false, reason, variations: list };
  }
}

window.InputGuard = InputGuard;
