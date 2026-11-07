# Backlog Semântico — Novo RAG de Intenções

Documenta bugs de roteamento que exigem resolução por **semântica de órbita**, não por patch pontual. Cada item aqui é um candidato a implementação no `ProjetoNovoRag/` (léxicos + motor parser).

---

## FIX SEMÂNTICO 01 — Pronome anafórico resolvido por órbita

**Sintoma:** "Ele tem link?" / "Ele programa?" — o pronome "ele/ela" pode se referir ao Marcos, ao projeto ativo, ao github, ao RAG, ao jogo. Depende da órbita ativa.

**Comportamento esperado:**
- `sobre_marcos` → "ele" = Marcos
- `projetos` + entidade ativa → "ele" = o projeto
- `contato` → "ele" = o último link/perfil mencionado
- sem contexto → default = Marcos (chat é sobre ele)

**Não fazer:** strip cego de "ele" via regex (quebra âncora semântica em outras órbitas).

**Status:** aguardando motor parser do `ProjetoNovoRag/`.

---

## FIX SEMÂNTICO 02 — "programa" verbo × substantivo

**Sintoma:** "Ele programa sem IA?" caía em `rc29` (programa de estágio/trainee) porque "programa" é token ambíguo.

**Workaround aplicado (2026-11-06):** Fix B em `ranker.js:651` — `meta_ia` não bloqueia mais `sobre_marcos` no `orbitConflict`. Resolve o caso com 3+ tokens, mas não resolve "ele programa" (2 tokens).

**Comportamento esperado:** desambiguação por POS (verbo "programa" = programar; substantivo "programa" = programa de estágio). Exige parser morfológico.

**Status:** workaround parcial. Solução completa aguarda `ProjetoNovoRag/`.

---

## FIX SEMÂNTICO 03 — `retrieveFallback` sequestra por 1 token raro

**Sintoma:** queries curtas (2 tokens) caem em `retrieveFallback` (linha 960) e casam passage por 1 token de alto idf. "ele programa" → `rc29` ("programa trainee").

**Comportamento esperado:** `retrieveFallback` exigir ≥2 tokens informativos casados antes de sequestrar.

**Status:** não aplicado. Candidato a patch pontual + teste de regressão com `_teste_rag.js` (200 queries).

---

## Regra de ouro

Nenhum item deste backlog pode ser resolvido por regex simples. Se a solução for "remover palavra X", é sinal de que a intenção não foi entendida — volta pra mesa.
