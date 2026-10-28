// ============================================================
// Biblioteca de palavras de teste — ORBITA CONTATO
// Trocar este arquivo pra testar outra órbita.
// ============================================================

module.exports = {
  nome: 'Contato',

  // Frases completas pra testar o MakeBlock
  frases: [
    'solta o linkedin ai',
    'me passa o linkedin, e o github',
    'solta o linkedin mais o email',
    'qual o linkedin? e o github tambem',
    'manda o zap e o email e o linkedin'
  ],

  // Frases pra testar HERANÇA de verbo nos blocos soma
  frasesHeranca: [
    'manda o linkedin e o github',
    'manda o linkedin e passa o github',
    'solta o zap mais o email'
  ],

  // Frases pra testar "como" ambíguo (história vs explicação)
  frasesComo: [
    'como foi o linkedin',
    'como surgiu o linkedin',
    'como funciona o linkedin',
    'como o linkedin ajuda',
    'como o linkedin'
  ],

  // Expectativa: qual atributo cada frase deve acionar
  comoEsperado: [
    { frase: 'como foi o linkedin', attr: 'historia' },
    { frase: 'como surgiu o linkedin', attr: 'historia' },
    { frase: 'como funciona o linkedin', attr: 'explicacao_da_historia' },
    { frase: 'como o linkedin ajuda', attr: 'explicacao_da_historia' }
  ],

  // Palavras soltas pra testar o Fuzzy (erradas de proposito)
  palavras: [
    'sota', 'likedin', 'lnkdn', 'linke', 'lnk', 'linkd',
    'passa', 'quero', 'o', 'do', 'qual',
    'zap', 'gitub', 'emal', 'watsap', 'celulr', 'numro',
    'contato', 'soltar', 'linkedin', 'link'
  ],

  // Casos de OVERWRITE — o que DEVE vencer
  overwrite: [
    { token: 'link',     esperado: 'link'     },
    { token: 'linke',    esperado: 'linkedin' },
    { token: 'lnk',      esperado: 'link'     },
    { token: 'linkd',    esperado: 'linkedin' },
    { token: 'lnkdn',    esperado: 'linkedin' },
    { token: 'likedin',  esperado: 'linkedin' },
    { token: 'linkedin', esperado: 'linkedin' }
  ],

  // Blocos esperados do MakeBlock
  blocosEsperados: [
    { frase: 'solta o linkedin ai',                 qtd: 1 },
    { frase: 'me passa o linkedin, e o github',     qtd: 2 },
    { frase: 'solta o linkedin mais o email',       qtd: 2 },
    { frase: 'qual o linkedin? e o github tambem',  qtd: 2 },
    { frase: 'manda o zap e o email e o linkedin',  qtd: 3 }
  ]
};
