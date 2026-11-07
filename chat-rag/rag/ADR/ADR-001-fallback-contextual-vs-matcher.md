# ADR-001 — Fallback contextual vence matcher persistente

**Data:** 2026-11-07
**Status:** Aceito
**Contexto:** Órbita `experiencia`, 12 perguntas de recrutador
**Autor:** Copiloto + Marcão (piloto)

---

## Contexto

Ao aplicar variants_answer em 8 nós da Bella Arte (`ex02`, `ex13`, `ex16`, `ex26`, `ex27`, `ex36`, `ex37`, `ex46`), o runner de entrevista mediu **1/12 de acerto**. O motor não alcançava as variants porque `matchQuestionAll` retornava vazio em queries curtas (1-2 tokens) ou com verbos específicos (`consertava`, `inventou`, `powershell`).

## O que tentamos (e falhou)

Foram **8 sandboxes** tentando consertar o matcher:

1. `_sandbox_universal` — detectDominio cede ao nó forte → 1/12 → 5/12 (fix real, aplicado)
2. `_sandbox_entity` — retry sem filtro de entity → 5/12 → 5/12 (não subiu)
3. `_sandbox_mqa` — retry sem entity no matchQuestionAll → 5/12 → 5/12
4. `_sandbox_mqa2` — 4 fixes isolados (minContent, strongRelax, df20, orbBoost) → 5/12 → 5/12
5. `_sandbox_orbit` — remover meta_ia/skills do ranked → 5/12 → 5/12
6. `_sandbox_final` — relax strong filter → 5/12 → 5/12
7. `_sandbox_th06` — relax + threshold 0.6 → 5/12 → 5/12
8. Trace de UMA query (`_trace_ex27`) — **único método que deu info real**

**Custo:** ~47 mensagens, 8 sandboxes, 5 diagnósticos, zero subida.

## A decisão

Ao invés de consertar o matcher (arquitetura frágil por design), **aceitamos que o matcher não acha tudo** e adicionamos fallback contextual por órbita:

- Quando `matchQuestionAll` retorna vazio + órbita ativa ≠ smalltalk → responde com mensagem honesta da órbita + zap do Marcão
- Interceptação movida pra **ANTES** do `detectDominio` (não em `sacredUnknown`)
- Novo `facet: sem_dado_ctx` pra métrica distinta

## Resultado

**1/12 → 9/12 profissional** (5 HIT + 4 HONEST). 3 MISS restantes entram no backlog semântico.

## Consequências

**Positivas:**
- Recrutador recebe resposta coerente em 9 de 12 perguntas
- Fallback genérico → contextual (não parece amador)
- Métrica separada (HIT/HONEST/MISS) permite evolução contínua
- Fix é universal (17 órbitas com fallback cadastrado)
- Aplicável em qualquer órbita sem tocar no matcher

**Negativas:**
- 4/12 perguntas não respondem o nó específico, só redirecionam pro WhatsApp
- `matchQuestionAll` continua frágil (bug documentado no BACKLOG_SEMANTICO.md)
- Solução completa depende do `ProjetoNovoRag/` semântico

## Lições aprendidas

1. **Trace > Sandbox cego.** Sandbox testa hipótese; trace revela onde o fluxo realmente morre. 8 sandboxes não substituíram 1 trace.
2. **Consertar camada errada é desperdício.** O fallback ficou inicialmente em `sacredUnknown`, mas as misses nunca chegavam lá — caíam no `detectDominio`. Achar a camada certa vale mais que afinar threshold.
3. **"Não precisa quebrar ovo com marreta, nem fritá-lo com maçarico."** — Marcão, MSG 82. A solução óbvia (fallback honesto + zap) sempre esteve na mesa. 47 mensagens pra chegar nela é aceitável como aprendizado, não como método.
4. **Ferramenta de teste precisa se provar antes de testar.** Runner sem timestamp, sem hash do JSON fonte, duplicado em `_teste_entrevista` + `_teste_entrevista2` — bug invisível que consumiu iterações.
5. **Métrica honesta vale mais que hit rate.** 5 HIT sozinho é fraco. 5 HIT + 4 HONEST = 9/12 profissional é defensável.

## Alternativas rejeitadas

- **Consertar o matcher (relaxar filtros):** 4 sandboxes provaram que relaxar `strong` filter não dispara em runtime — wrapper de sandbox não substitui o método real chamado pelo `_answer`. Correção real exige mexer no `dialog_state.js` (não testado em produção).
- **Adicionar 100 variants por nó:** volta ao erro dos 400 bugados. Matcher não acha mesmo com variants corretas (ex27 com 5 variants novas ainda miss).
- **Trocar RAG vetorial por semântico agora:** fora do escopo da rodada. Vai pro `ProjetoNovoRag/`.

## Arquivos tocados

- `chat-rag/rag/responses/unknown_sacred.json` (+ seção `contextual.por_orbita`)
- `chat-rag/rag/engine/ranker.js` (+ 2 fixes: `FIX CONTEXTUAL-FALLBACK`, `FIX CTX-PRE-DOMINIO`)

## Referências

- `chat-rag/rag/BACKLOG_SEMANTICO.md` (5 itens)
- `_runner_experiencia.js` + `_perguntas_experiencia.json` (ferramenta de teste fresca)
- Commit `33a0212` (fix universal VA + variants Bella Arte)
