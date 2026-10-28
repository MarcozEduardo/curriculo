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
