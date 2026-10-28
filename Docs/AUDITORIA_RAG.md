# AUDITORIA COMPLETA DO RAG CURRÍCULO

**Data:** 16/10/2026
**Autor:** Bobby (IA) para Marcos Eduardo da Silva dos Reis
**Motivo:** Documentar tudo que foi feito, o que está funcionando, o que quebrou, o que ficou pendente.

---

## 1. ARQUIVOS CRIADOS NA SESSÃO (raiz de `curriculo/`)

### 1.1 Dados novos (dentro de `chat-rag/rag/`)

| Arquivo | O que faz | Estado |
|---------|-----------|--------|
| `mesh/dominio.json` | 5 domínios (Fabricart, CNC Laser, Bella Arte, Prepara, Friends) com fragmentos por gatilho | ✅ Funcionando |
| `mesh/torch.json` | 4 intents (identidade, utilidade, capacidade, honestidade) com first/repeat | ✅ Funcionando |
| `mesh/palavras-projetos.json` | Âncoras, especificadores, pontes, fura da órbita projetos | ⚠️ Só projetos |
| `dictionary/bold_words.json` | 70 palavras que ganham negrito automático | ⚠️ Bug de split |
| `mesh/questions/glossario.json` | 81 entries das facets do glossário | ✅ Funcionando |
| `mesh/questions/sobre_curriculo.json` | 48+ entries sobre o currículo | ✅ Funcionando |

### 1.2 Órbitas novas (dentro de `orbits.json`)

| Órbita | O que faz | Estado |
|--------|-----------|--------|
| `glossario` | RAG, embedding, python, javascript, typescript, react | ✅ Funcionando |
| `sobre_curriculo` | PDF, QR Code, galeria, leitura focada, mérito, como foi construído | ✅ Funcionando |
| `escolha_do_bot` | "Me surpreende", "conta uma boa", "novidade", histórias | ✅ Funcionando (frágil) |

### 1.3 Facets novas (dentro de `facets.json`)

- `rag`, `embedding`, `python`, `javascript`, `typescript`, `react`
- `quem_fez` (quem criou/desenvolveu o Bobby)
- `por_que_contratar`
- `sobre_curriculo`, `construcao_curriculo`, `pdf_curriculo`, `qr_code_curriculo`, `galeria_curriculo`, `leitura_focada`, `merito_curriculo`, `diferenca_pdf_app`
- `escolha_do_bot`, `novidade`, `duvida_de_que`

### 1.4 Scripts de teste/auditoria criados (raiz de `curriculo/`)

Mais de **80 scripts `_*.js`** na raiz, todos temporários. Podem ser apagados sem afetar o RAG. Lista resumida:

- `_test-rag.js` (25 perguntas)
- `_test-creative.js` (44 perguntas em 6 camadas)
- `_test-tocha.js`, `_test-dominios.js`, `_test-espera.js`, `_test-ancora.js`, `_test-projetos-class.js`, `_test-rot.js`, `_test-escolha.js`, `_test-curriculo.js`, `_test-bold.js`, `_test-heat.js`
- `_simulador.js` (40 recrutadores x 5 turnos = 200 turnos)
- `_trace-query.js`, `_trace-facet.js` (debug do pipeline)
- `_tool-palavras.js`, `_tool-contexto.js`, `_tool-sandbox.js`, `_explorar-nos.js`
- `_audit-marcos.js`, `_audit-furabolha.js`
- Todos os `_fix-*.js` (cada um foi um patch aplicado)

---

## 2. ARQUIVOS MODIFICADOS (dentro de `chat-rag/rag/`)

### 2.1 `engine/orbit_router.js`

- Adicionado `this.orbitHeat = new Map()` (temperatura por órbita)
- Adicionado `this.tokensByOrbit = new Map()` (tokens distintivos por órbita)
- Adicionado método `tickHeat(queryTokens, activeOrbit)` (decay 1x por turno + aquecimento)
- Removido o decay de dentro do `route()` (era chamado 3x por turno e matava o heat)

**Estado:** funcionando. `tickHeat` é chamado 1x pelo ranker. Heat não está sendo usado para decisão real (só bônus de +0.5/turno).

### 2.2 `engine/ranker.js` (arquivo mais modificado)

Modificações aplicadas (linha aproximada):

| Linha | O que faz | Estado |
|-------|-----------|--------|
| 96 | Carrega `palavras-projetos.json` | ✅ |
| 126 | `summarize` limpa lead humanizado antes de cortar | ✅ |
| 184 | `FIX SAUDACAO-AUTO`: se for 1º turno e sem saudação, prefixa "Opa, bom dia/tarde/noite" | ✅ |
| 236 | `FIX FURA-BOLHA`: chama `router.tickHeat` 1x por turno | ✅ |
| 256 | `FIX B`: pre-check escolha_do_bot | ✅ |
| 275 | `FIX ESCOLHA-ROT`: rotação de histórias | ✅ |
| 291 | `FIX 1.7 Tocha`: 4 intents de auto-referência | ✅ |
| 335 | `FIX ANCORA-CONTEXTO v4/v5`: herança de pronome | ⚠️ parcial, dentro do `if(dominios)` |
| 372 | `FIX PROJETOS-PRECHECK`: ponte-pedido sem âncora → dúvida | ⚠️ regride casos |
| 392 | `FIX G2` + `G2b`: skipPending quando a query é pergunta real | ✅ |
| 499 | `FURA-BOLHA v3`: orbitConflict (nó perde se router prefere outra órbita) | ✅ |
| 512 | `FIX duvida_de_que`: pergunta sem sujeito → "X de quê?" | ⚠️ dispara demais |
| 519 | `FIX LABEL-DUVIDA`: pega facet real por trás de duvida_de_que | ✅ |
| 612 | `FIX A`: se entity não tem facet mas facet tem home_orbit, abandona entity | ✅ |
| 884 | `FIX C`: só usa pendente se for da órbita ativa | ✅ |
| 1203 | `FIX GREETING-SOZINHO`: "fala sobre X" não é saudação | ✅ |
| 1210 | `FIX 1b`: saudação repetida → resaudacao | ✅ |
| 1303 | `FURA-BOLHA v2`: isContinuation não herda se tem token de outra órbita | ✅ |
| 1408 | `FIX TORCH-RAW`: usa raw sem tokenize | ✅ |
| 1416 | `FIX TOCHA-V2`: quem criou/fez/programou → pipeline normal | ✅ |
| 1433 | `FIX TOCHA-V2`: contador por intent (não global) | ✅ |

### 2.3 `engine/humanizer.js`

| Linha | O que faz | Estado |
|-------|-----------|--------|
| 13 | Carrega `bold_words.json` | ✅ |
| 76 | `paragrafar()` — ponto + maiúscula vira bloco separado | ✅ |
| 99 | `bolding()` — aplica `**` em palavras-chave | 🔴 BUG de split, pode quebrar pares |
| 119 | `FIX LOWERCASE` — depois de vírgula/dois-pontos, lowercase | ✅ |
| 125 | `compose()` chama `paragrafar(bolding(final))` | ✅ |

### 2.4 `engine/memory.js`

- `FIX 3`: primeira vez que uma chave é usada, `pick` retorna índice 0 (resposta canônica). Só depois gira.

### 2.5 `engine/dialog_state.js`

- `FIX TUDO v3`: regex `todos/todas/ambos` exige fim de linha. Removido "tudo" (evita "tudo bem" virar escolha).

### 2.6 `engine/facet_detector.js`

- `GENERIC_KEY` expandido com: quero, queria, gostaria, preciso, saber, conhecer, conhece, fala, falar, fale, conta, contar, diz, dizer, mostra, mostrar, explica, explicar, ver, manda, mandar, traz, apresentar, apresenta, candidato, profissional, dev, pessoa, perfil, assistente, autor, criador, bot, bobby, chat, site, sistema, pergunta, duvida, informacao, detalhe, detalhes.

**Isso resolveu o sequestro de `quem_fez` em queries comuns.**

### 2.7 `mesh/orbits.json`

- 3 órbitas novas: `glossario`, `sobre_curriculo`, `escolha_do_bot`
- Texto canônico de `sobre_marcos/default` reescrito pro tom história
- Textos de `sobre_curriculo` com fragmentos ricos

### 2.8 `mesh/questions/*.json`

- Novos: `glossario.json`, `sobre_curriculo.json`
- Editados: todas as órbitas receberam entries ao longo das rodadas

### 2.9 `mesh/deepening/*.json`

- `sm01` (Quem é o Marcos?) reescrito em tom história
- `sm01` e outros 7 nós com história do banco corrompido reescritos em 9 lugares

---

## 3. O QUE ESTÁ FUNCIONANDO (confirmado por teste)

- ✅ Glossário técnico (RAG, embedding, python, javascript, typescript, react) com 5 variações por faceta
- ✅ Tocha (auto-referência): "você é IA?", "tu serve pra quê?", "você mente?", "você entende?" — cada um com first/repeat
- ✅ Domínios: Fabricart, CNC Laser, Bella Arte, Prepara, Friends com fragmentos ricos
- ✅ Saudação automática por horário no 1º turno sem saudação
- ✅ Saudação repetida (resaudacao) quando o usuário cumprimenta 2x
- ✅ Escolha do bot ("me surpreende", "conta uma boa", "novidade", rotação de histórias)
- ✅ Palavras em negrito (70 termos) — visualmente, quando o split do `**` não quebra
- ✅ Parágrafos entre frases longas
- ✅ Picker canônico (1ª vez retorna índice 0)
- ✅ IA gratuita como fato em vários lugares
- ✅ Banco corrompido como história completa em 9 lugares
- ✅ Histórias ricas (banco, SOCRAM, psicólogo de IA, Dama Orbital, LAR)
- ✅ Fura-bolha (heat por órbita com decay 1x/turno)
- ✅ Facets guard contra `quem_fez` sequestrando queries comuns
- ✅ SkipPending para perguntas reais
- ✅ Saudação-sozinho ("Fala sobre X" não é saudação)

---

## 4. O QUE ESTÁ QUEBRADO (identificado nos testes)

### Bug crítico 1 — `matchQuestion` sequestra perguntas amplas

**Exemplo:** `Quem é o Marcos Eduardo?` cai em `sobre_marcos` mas um nó estreito de "informalidade do nome" responde antes.

**Causa raiz:** `dialog.matchQuestion` aceita nó com score ≥ 0.72 sem checar se o router prefere outra órbita.

**Tentativas de fix que NÃO resolveram:** orbitConflict (funciona parcialmente), guardedFacet (só pra facets específicas), threshold.

### Bug crítico 2 — `duvida_de_que` dispara em perguntas com alvo óbvio

**Exemplo:** `Qual a stack?` → "Tecnologias de quê? Ainda não me disse o alvo."

**Causa raiz:** o guard exige `!activeEntity && rawTokens.length <= 4`. Não consulta `memory.activeOrbit`.

**Frequência:** 10+ turnos em 200 da simulação.

### Bug crítico 3 — `contato` sequestra 6 turnos

**Exemplo:** `Qual a experiência profissional dele?` → contato

**Causa raiz:** a palavra `curriculo`, `perfil`, `falar` puxam `contato` porque estão nos keywords da órbita.

### Bug crítico 4 — Tocha vaza em 5 turnos

**Exemplo:** `tem sentimentos?` cai em `historia_pessoal/tentativas`

**Causa raiz:** expressões sobre a natureza do bot que não usam `tu/voce/bob` não disparam tocha.

### Bug crítico 5 — Falso positivo de hostile

**Exemplo:** `me conta uma piada` → moderacao/hostil

### Bug menor — Bolding pode quebrar pares

O `split("**")` perde pares quando o texto já tem `**` do offer anexado. Efeito: **bold gigante engolindo o texto todo** (visto em "Quem é o Marcos Eduardo?" no print).

---

## 5. IDEIAS PEDIDAS E NÃO ENTREGUES

| # | Ideia | Status |
|---|-------|--------|
| 1 | Classes universais (Âncora/Ponte/Especificador/Furo) | ⚠️ Só pra projetos |
| 2 | Biblioteca universal de palavras+sinônimos por órbita | ⚠️ Só projetos |
| 3 | Irmãs gêmeas (co-ocorrência por sandbox) | 📊 Análise pronta, não aplicada |
| 4 | Similaridade com porcentagem exposta | ❌ Não feita |
| 5 | Fuzzy com % de mira | ❌ Não feita |
| 6 | Estado de espera de alvo ("o bot pergunta e espera") | ⚠️ Parcial |
| 7 | Rastro de conversa consultado pelos guards | ⚠️ Parcial |
| 8 | Moderação contextual (carai de ênfase ≠ ofensa) | ❌ Não feita |
| 9 | 10-15 variações do texto de dúvida | ❌ Só 1 hardcoded |
| 10 | Painel RAG Config | ❌ Criado e deletado (inútil) |
| 11 | Domínio industrial expandido (rolamento, eixo, tubo CO2) | ⚠️ Parcial |
| 12 | Anáfora "dele/ele" herda contexto | ⚠️ Parcial |
| 13 | Escolha do bot com coringa variado | ✅ |
| 14 | Histórias rotativas | ✅ |

---

## 6. ARQUIVOS QUE PODEM SER APAGADOS SEM RISCO

- Todos os `_*.js` na raiz (80+ arquivos) — são scripts de teste/audit
- `_simulacao-40.json`, `_nos-compacto.json`, `_palavras-ranking.json`
- `AUDITORIA_RAG.md` (este arquivo, depois de ler)

---

## 7. PRÓXIMOS PASSOS RECOMENDADOS

### Ordem de ataque

1. **Consertar o bug 2 (`duvida_de_que`)** — 1 edição: o guard deve consultar `memory.activeOrbit` e `memory.lastReply`. Se tem contexto vivo, não dispara dúvida.

2. **Consertar o bug 1 (`matchQuestion`)** — precisa de decisão estrutural: ou sobe threshold, ou adiciona filtro "se router tem âncora forte ≠ órbita do nó, rejeita".

3. **Consertar o bug 3 (`contato`)** — remover `curriculo`, `perfil`, `falar` dos keywords de contato. Eles não são específicos de contato.

4. **Bolding** — desligar temporariamente pra não quebrar visual. Reativar quando o split estiver correto.

5. **Tocha vazando** — adicionar mais gatilhos ("tem sentimentos", "uma pessoa tá digitando", "isso é script").

### O que NÃO fazer

- Não criar mais patches por cima. Cada patch novo tem risco de regredir outro caso.
- Não criar mais scripts. Focar em fechar os 5 bugs.
- Não mexer em orbit_router (fura-bolha tá funcionando).

---

## 8. VERDADE FINAL

**O motor está de pé.** 140 de 200 turnos da simulação responderam razoavelmente. Os 60 turnos problemáticos compartilham a mesma causa raiz: decisão baseada só na última mensagem, sem consultar `memory.activeOrbit` + `memory.history` para desambiguar.

**A correção estrutural é 1 método novo: `resolveOrbitComContexto()` que substitui 3 guards conflitantes (`duvida_de_que`, `CONTEXTO-PONTE`, `CONTEXTO-VAGO`) por 1 lógica coerente.**

Se o motor for reconstruído, o esqueleto atual (órbitas, facets, entities, deepening, questions) é reaproveitável. Só a camada de decisão (ranker) precisa ser limpa.
