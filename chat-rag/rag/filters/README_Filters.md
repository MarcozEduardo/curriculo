# 🛡️ Filtros de moderação

### `profanity_filter.js` (`ProfanityFilter`)

- **Função:** compara o texto em três formas (normalizado, leet-normalizado e sem espaços) contra `dictionary/profanity_list.json`, evitando burlas como `p0rr4` ou `c a r a l h o`.
- **Deps:** `LeetNormalizer`, `dictionary/profanity_list.json`.
- **UsedBy:** `engine/ranker.js` (etapa 1 de `answer()`).
- **Retorno:** `{ isProfane: boolean, word?: string }`.

### Escalonamento

O `ranker` conta as ocorrências em `SessionMemory.abuseCount`:

1. 1ª vez → aviso leve (`responses/profanity_response.json` → `variations`)
2. 2ª vez em diante → `escalada[]`, terminando em encerramento educado com o contato direto do Marcos

> Termos que são apenas provocação ao bot (ex.: "você é burro") **não** entram na lista de palavrões: eles caem na intenção `teste_bot` de `responses/user_identity.json`, que responde com bom humor.

### `input_guard.js` (`InputGuard`)

- **Função:** higiene da entrada antes de qualquer busca.
  - Repetição de letras: bloqueia 7+ caracteres iguais seguidos ou padrão de 2 a 4 letras repetido 5+ vezes, **exceto risadas** (`kkkk`, `hahaha`, `rsrsrs`, `hehe`, `kakaka`).
  - Números: bloqueia 7+ dígitos iguais seguidos (`666666` passa, `6666666` não) e blocos com 18+ dígitos.
  - Código: pontua padrões de JS/Python/SQL/HTML/shell e densidade de símbolos; 2 ou mais indícios bloqueiam.
  - Injeção: "ignore as instruções", "system prompt", "finja que", "você agora é", etc.
  - Comprimento: acima de 500 caracteres pede resumo (o campo do chat limita em 400).
- **Deps:** `responses/input_guard.json`. **UsedBy:** `engine/ranker.js` (etapa 0 de `answer()`).
- **Retorno:** `{ ok: true }` ou `{ ok: false, reason, variations }`.
