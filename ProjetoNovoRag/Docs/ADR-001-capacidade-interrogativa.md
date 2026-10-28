# ADR-001 — Capacidade Interrogativa no Motor RAG

- **Status:** Proposto
- **Data:** 2026-10-20
- **Contexto:** ProjetoNovoRag · piloto LinkedIn
- **Decisores:** Marcos (comandante), copiloto IA
- **Documento derivado de:** auditoria de `motor-browser.js` v430 + `linkedin.json` v212 + `RulesWords/Interrogativos.json` v88

---

## 1. Contexto

O motor RAG do ProjetoNovoRag foi construído em 3 estágios (MakeBlock → FuzzyFuncionario → FuzzyBoss). A ficha do objeto LinkedIn (212 linhas) declara 8 seções de capacidade: identidade, hierarquia, sensores, propriedades, dinâmica, execução, **capacidade interrogativa** e **árvore de fallback**.

A auditoria do `motor-browser.js` revelou que **apenas 2 das 8 seções são lidas pelo motor**: identidade parcial (`id`, via comparação de objeto) e mapa de intenções (`intencoes[*].acionado_por`). As outras 6 são declaração inerte.

Isto não é problema enquanto há 1 objeto e 20 frases de teste. Torna-se bloqueante quando a meta declarada pelo comandante é atingida: *"quero criar uma classe pra cada OBJETO que exista"*.

---

## 2. Evidências (estado do disco)

| # | Fato verificado | Impacto |
|---|---|---|
| E1 | `motor-browser.js` não referencia `ficha.interrogativos` em nenhuma linha | Bloco interrogativos é código morto |
| E2 | `casarIntencao` ordena por `score = prioridade + matches`. `acao_fallback_interrogativo` tem prioridade 1 e `modo: always`; `acao_fallback` tem prioridade 0 e `modo: always`. Logo: **toda frase sem match vira fallback interrogativo**, inclusive `"banana"`. | Semântica dos fallbacks está invertida |
| E3 | `sabe_responder: false` em `interrogativo_pessoa` e `interrogativo_quantidade` não tem efeito no motor | `false` é decorativo |
| E4 | `requer_estado: "contado_historia"` e `on_estado_fail: "suggest"` em `interrogativo_explicacao` não são lidos | Dependência história→explicação não é enforçada |
| E5 | `requer_sensor`, `depende_de`, `modificadores_opcionais`, `boost_com_modificador`, `atributos[*].tipo`, `buscar_em`, `on_missing` — todos declarados, nenhum lido | 70% da ficha é decorativa |
| E6 | `dadosResposta` em `test-dinamico.js` carrega 3 chaves (`link`, `historia`, `explicacao_da_historia`), mas `acao_definir_objeto.atributo_alvo = "definicao"` | `"o que é o linkedin"` casa a intenção mas cai em debug `[definicao: arquivo não carregado]` |
| E7 | `RulesWords/Interrogativos.json` declara 6 subtipos; o template do comandante pede 8 (faltam `interrogativo_dinamica` e `interrogativo_execucao`) | Léxico incompleto para o modelo de classe |

---

## 3. Problema

O modelo declarativo dos objetos ("cada campo declarado é campo lido") está **70% violado**. O motor funciona por caminho lateral: interrogativos são roteados via `intencoes[*].acionado_por` (gramática fazendo papel de ação), enquanto o bloco `interrogativos` da ficha permanece decorativo.

Em 1 objeto, o custo é dívida silenciosa. Em N objetos, o custo é **inflação linear**: cada novo objeto precisa replicar 6-8 intenções `acao_interrogativo_*` para cobrir o mesmo terreno que 1 bloco interrogativos cobriria — e ainda assim não ganha `requer_estado`, `sabe_responder: false` semântico, nem fallback por capacidade.

A decisão a tomar é: **como o motor deve tratar a capacidade interrogativa declarada na ficha do objeto?**

---

## 4. Opções

### Opção A — Implementar o bloco `interrogativos` no motor

Motor ganha função `resolverInterrogativo(subtipo, ficha)` que consulta `ficha.interrogativos[subtipo]`:
- `sabe_responder: true` → pega `atributo` → verifica `requer_estado` → responde
- `sabe_responder: false` → cai em `acao_fallback_interrogativo`
- Subtipo ausente na ficha → cai em `acao_fallback` geral

`decidir()` chama `resolverInterrogativo` antes de `casarIntencao`. `acao_fallback_interrogativo` deixa de ser `always` e passa a ser invocado só por `resolverInterrogativo`.

**Prós**
- Alinha código com `_meta.convencoes` do JSON (que declara o bloco como fonte de verdade)
- Elimina dual source of truth
- Implementa `sabe_responder`, `requer_estado`, `on_estado_fail`, `atributo`
- Remove necessidade de `acao_definir_objeto` (vira `sabe_responder: true` no bloco)
- Escala para N objetos sem mudar motor
- Fallback interrogativo e fallback geral ganham semântica correta

**Contras**
- ~100-150 linhas de motor novo
- 1-2 dias de implementação + testes
- Risco de regressão no que funciona hoje (20 frases)
- Precisa ampliar suíte de teste pra cobrir os 6-8 subtipos

### Opção B — Deletar o bloco `interrogativos`, mover tudo para `intencoes`

Todo roteamento interrogativo passa a viver em `intencoes[*].acionado_por`, como hoje. Bloco `interrogativos` é removido das fichas. `_meta.convencoes.interrogativos` é removido.

**Prós**
- Motor fica menor (zero código novo)
- Uma única fonte de verdade explícita (`intencoes`)
- Menor risco de regressão
- Ficha do objeto encolhe ~30 linhas

**Contras**
- Perde `sabe_responder: false` semântico (objeto não pode declarar "não sei responder isso" — vira silêncio, indistinguível de "não foi implementado")
- Perde `requer_estado` (não há como expressar "explicação só depois de história")
- Perde fallback por capacidade (fallback interrogativo deixa de existir como conceito)
- Cada novo objeto precisa de 6-8 intenções `acao_interrogativo_*` — infla JSON com N objetos
- Contradiz o template do comandante (seção 7 e 9)

### Opção C — Manter estado atual (dívida anotada, avançar)

Nada muda. Motor continua roteando interrogativo via `intencoes`. Bloco `interrogativos` continua decorativo.

**Prós**
- Zero trabalho imediato
- Piloto LinkedIn avança pro próximo item (GitHub, Email, WhatsApp)
- Decide com mais dados reais (testar em 3-4 objetos antes de decidir arquitetura)

**Contras**
- Dívida cresce linearmente com cada objeto novo
- `sabe_responder: false`, `requer_estado`, `depende_de` permanecem inertes em todos os objetos
- Bug semântico de fallback (E2) persiste: `"banana"` → fallback interrogativo
- `_meta` mente sobre o que o motor consome

---

## 5. Critérios de avaliação

| Critério | Peso | Justificativa |
|---|---|---|
| Custo de implementação | Alto | Comandante opera em modo iterativo ("devagar para não atolar") |
| Alinhamento com meta declarada (classe por objeto) | Alto | Exigência explícita do comandante |
| Risco de regressão | Alto | 20 frases de teste passando hoje; quebrar é caro |
| Escalabilidade (N objetos) | Médio | 1 objeto hoje, mas meta declarada é N |
| Manutenibilidade | Médio | Ficha declarativa só é útil se lida |
| Velocidade de entrega do piloto | Médio | Há pressão de avançar para próximo objeto |

---

## 6. Análise comparativa

| Critério | A | B | C |
|---|---|---|---|
| Custo de implementação | Alto | Zero | Zero |
| Alinhamento com meta | Total | Parcial | Nulo |
| Risco de regressão | Médio | Baixo | Nulo |
| Escalabilidade | Alta | Baixa | Nula |
| Manutenibilidade | Alta | Média | Baixa |
| Velocidade do piloto | Média | Alta | Alta |

**Leitura:**
- A e B são mutuamente exclusivas como destino arquitetural.
- C não é destino: é adiamento.
- B resolve hoje, mas contradiz a meta declarada (classe por objeto, seção 7 e 9 do template).
- A resolve hoje E sustenta a meta, ao custo de implementação.

---

## 7. Recomendação

**Opção A, em duas fases.**

A meta declarada pelo comandante (classe por objeto) é incompatível com B e C. B e C resolvem o LinkedIn e quebram em N objetos. A única opção que sustenta a visão é A.

O receio legítimo é custo/risco de uma implementação monolítica. Por isso, **A em duas fases**, alinhado ao modo iterativo do comandante:

### Fase 1 — Fechar o buraco principal (bloqueante)

Escopo:
- Motor lê `ficha.interrogativos[subtipo]`
- `sabe_responder: true` → `atributo` → responde
- `sabe_responder: false` → `acao_fallback_interrogativo`
- Subtipo ausente na ficha → `acao_fallback`
- `acao_fallback_interrogativo` deixa de ser `always` (passa a ser invocado por `resolverInterrogativo`)
- Adiciona `interrogativo_dinamica` e `interrogativo_execucao` ao `Interrogativos.json`
- LinkedIn marca ambos com `sabe_responder: false` (não tem atributos pra eles)

Estimativa: ~80 linhas motor + 2 subtipos de léxico + ajuste na ficha. 1 dia.

Saída esperada: `"quem fez o linkedin"` cai em fallback interrogativo **semântico** (porque `sabe_responder: false`), e não por acidente. `"banana"` cai em fallback geral. 20 frases de teste continuam passando.

### Fase 2 — Fechar dependência de estado (não bloqueante)

Escopo:
- Motor lê `requer_estado` no bloco
- Se estado (`ficha.estado_schema`) satisfaz → responde
- Se não → aplica `on_estado_fail` (`suggest` / `auto_run` / `bypass` / `error`)

Estimativa: ~50 linhas motor + implementação do estado de sessão (que ainda não existe). 1 dia.

Saída esperada: `"me explica a história do linkedin"` antes de `"me conta a história"` pergunta ao usuário se quer contar primeiro, em vez de explicar sem contexto.

### O que NÃO entra no escopo

- `requer_sensor` (Fase 3, quando houver objeto com sensor false real)
- `depende_de` / `on_depende_fail` em `intencoes` (Fase 3, substituído por `requer_estado` no bloco)
- `modificadores_opcionais` / `boost_com_modificador` (Fase 4, otimização)
- `atributos[*].tipo`, `buscar_em`, `on_missing` (Fase 4, quando `dadosResposta` for carregado por caminho em vez de mapa hardcoded)

Esses campos continuam decorativos em Fase 1 e 2 — mas o comandante sabe disso explicitamente, e não descobre depois.

---

## 8. Consequências

### Positivas
- Bloco `interrogativos` deixa de mentir
- Fallback interrogativo ganha semântica real (por capacidade, não por acidente)
- Novos objetos herdam capacidade interrogativa de graça, sem replicar intenções
- `_meta.convencoes` do JSON passa a ser verdade
- Próxima decisão (requer_sensor, dependências) tem base sólida

### Negativas
- Motor ganha ~130 linhas ao final das 2 fases
- Curva de teste aumenta (8 subtipos × 2 valores de `sabe_responder` = 16 casos mínimos)
- Comandante precisa testar mais antes de considerar fechado

### Neutras
- `acao_definir_objeto`, `acao_contar_historia`, `acao_explicar_historia` permanecem como intenções por verbo. Só o roteamento interrogativo muda de via.

---

## 9. Alternativas rejeitadas

**Rejeitada: implementar tudo de uma vez (A monolítica).**
Contraria o modo iterativo do comandante e concentra risco. `requer_sensor`, `depende_de`, `modificadores_opcionais` são otimizações sem pressão real — não bloqueiam o piloto.

**Rejeitada: B com reintrodução futura do bloco.**
Migrar pra B e depois voltar pra A custa duas refatorações. Se a meta é classe por objeto, A é o destino. Não há ganho em passar por B.

**Rejeitada: C com aviso no `_meta`.**
Anotar dívida no `_meta` não resolve o problema — só o torna documentado. C aceitável em cenário de 1 objeto congelado. Não é o cenário do comandante ("quero criar uma classe pra cada OBJETO que exista").

---

## 10. Aprovação

Este ADR aguarda decisão do comandante. Uma vez aprovado, entra em vigor como spec vinculante para as Fases 1 e 2.

**Decisão esperada:** ☐ Aprovar A em 2 fases · ☐ Aprovar A monolítico · ☐ Aprovar B · ☐ Aprovar C · ☐ Outro (especificar)

---

*Documento gerado em 2026-10-20. Baseado em auditoria estática de motor-browser.js v430, linkedin.json v212, Interrogativos.json v88, Verbos.json v29. Nenhum arquivo do projeto foi modificado durante a auditoria.*
