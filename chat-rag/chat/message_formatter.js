/**
 * MessageFormatter - markdown mínimo e seguro → HTML.
 * Suporta **negrito**, *itálico*, `código`, listas com • ou -, links [texto](url)
 * e autolink de URLs cruas. Escapa HTML antes de qualquer conversão.
 */
class MessageFormatter {
  static escape(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

    static autoBold(html) {
    var words = [
      'Marcos', 'Marcao', 'Bobby', 'Bob', 'LAR', 'Nexus', 'Franzinha',
      'RAG', 'MCP', 'LLM', 'QA', 'TI', 'API', 'REST', 'JSON', 'OCR', 'ABNT', 'PCD', 'TEA',
      'Python', 'SQL', 'TypeScript', 'JavaScript', 'Canvas 2D', 'WebRTC', 'Firebase', 'Supabase', 'Vercel', 'Netlify', 'Git', 'GitHub',
      'Hiperfoco', 'Neurodivergencia', 'Depuracao', 'Debug', 'Fuzzy', 'Leet'
    ];
    // So dentro de texto fora de tags: divide por tags e aplica so em segmentos de texto
    var parts = html.split(/(<[^>]+>)/);
    var boldSet = new Set(words.map(function(w){ return w.toLowerCase(); }));
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].charAt(0) === '<') continue;
      var txt = parts[i];
      var out = '';
      var re = /([A-Za-zÀ-ÿ]+(?:[s][A-Za-zÀ-ÿ]+)?)/g;
      var last = 0; var m;
      while ((m = re.exec(txt)) !== null) {
        var word = m[1];
        if (!boldSet.has(word.toLowerCase())) continue;
        out += txt.slice(last, m.index);
        out += '<strong>' + word + '</strong>';
        last = m.index + word.length;
      }
      if (last > 0) {
        out += txt.slice(last);
        parts[i] = out;
      }
    }
    return parts.join('');
  }

  static format(text) {
    if (!text) return "";
    let safe = this.escape(text);

    // links markdown
    safe = safe.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1 <i class="fa-solid fa-arrow-up-right-from-square"></i></a>'
    );

    // URLs soltas (não já convertidas)
    safe = safe.replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$2</a>'
    );

    safe = safe
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

    // Negrito automatico em termos-chave (so fora de tags HTML ja convertidas)
    // Pre-pass: Lei Federal XXX (numero, /ano, etc)
    safe = safe.replace(/(Lei\s+Federal\s+(?:n[º°]\s*)?[\d.\/\-]+(?:\/\d+)?)/gi, '<strong>$1</strong>');
    safe = this.autoBold(safe);

    return safe
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("• ") || trimmed.startsWith("- ")) {
          return `<div class="chat-bullet">• ${trimmed.slice(2)}</div>`;
        }
        return line;
      })
      .join("<br>")
      .replace(/(<\/div>)<br>/g, "$1");
  }
}

window.MessageFormatter = MessageFormatter;
