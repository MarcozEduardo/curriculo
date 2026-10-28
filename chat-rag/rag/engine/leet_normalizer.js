/**
 * LeetNormalizer - normalização agressiva de texto do usuário.
 * Trata acentos, leetspeak (m4rc0s, p0rr4), repetição de letras (oiiii),
 * gírias de internet (vc, pq, blz) e espaçamento sujo. Base de todo o pipeline.
 *
 * Leet é convertido POR PALAVRA, e só quando parece disfarce: palavra com letras,
 * dígitos em quantidade menor ou igual à de letras, e sem blocos de 2+ dígitos
 * (preserva CS50, ES2015, 2024, 98222) nem siglas conhecidas (N1, S3, P2P, MP3).
 */
class LeetNormalizer {
  static leetMap = {
    "4": "a", "@": "a", "3": "e", "1": "i", "0": "o", "5": "s", "$": "s", "7": "t", "+": "t", "8": "b", "9": "g", "6": "g",
  };

  static PROTECTED = /^(n[123]|s3|a4|p2p|b2[bc]|3d|2d|4k|8k|5g|4g|3g|es6|mp3|mp4|md5|h264|x86|x64|ipv4|ipv6|utf8|e2e|k8s|i18n|\d+k)$/;

  static slang = {
    vc: "voce", vcs: "voces", pq: "porque", pqp: "porra", blz: "beleza", vlw: "valeu",
    tb: "tambem", tbm: "tambem", qnd: "quando", qdo: "quando", qnt: "quanto", qto: "quanto",
    hj: "hoje", msm: "mesmo", mto: "muito", mt: "muito", tdb: "tudo bem", tds: "todos",
    ngm: "ninguem", aki: "aqui", kd: "cade", cmg: "comigo", flw: "falou", abc: "abraco",
    sdd: "saudade", dps: "depois", agr: "agora", pfv: "por favor", pf: "por favor",
    oq: "o que", pra: "para", pro: "para o", naum: "nao", num: "nao",
    eh: "e", neh: "ne", tah: "ta", ta: "esta", to: "estou", vo: "vou",
    exp: "experiencia", tec: "tecnico", dev: "desenvolvedor", prog: "programador", tech: "tecnologia", info: "informacao",
  };

  /** Remove acentos e baixa caixa, sem mexer em dígitos. */
  static deburr(text) {
    if (!text || typeof text !== "string") return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /** Normalização leve: acentos + espaços (preserva números significativos). */
  static light(text) {
    return this.deburr(text).replace(/\s+/g, " ").trim();
  }

  /** Converte uma palavra leet (p0rr4 -> porra) quando ela parece disfarce. */
  static deleetWord(word) {
    const letters = (word.match(/[a-z]/g) || []).length;
    const marks = (word.match(/[0-9@$+]/g) || []).length;
    if (letters < 1 || !marks || marks > letters) return word;
    if (/\d{2,}/.test(word) || this.PROTECTED.test(word)) return word;
    return word.replace(/[0-9@$+]/g, (c) => this.leetMap[c] || c);
  }

  /** Normalização completa: leet, repetições, gírias. */
  static normalize(text) {
    let clean = this.deburr(text);
    if (!clean) return "";

    clean = clean
      .replace(/(?<=[a-z])[!|](?=[a-z])/g, "i")
      .replace(/[a-z0-9@$+]+/g, (run) => this.deleetWord(run));

    // letras repetidas: "oiiii" -> "oii"
    clean = clean.replace(/(.)\1{2,}/g, "$1$1");

    clean = clean
      .split(/\s+/)
      .map((w) => this.slang[w.replace(/[^a-z0-9]/g, "")] || w)
      .join(" ");

    return clean.replace(/\s+/g, " ").trim();
  }
}

window.LeetNormalizer = LeetNormalizer;
