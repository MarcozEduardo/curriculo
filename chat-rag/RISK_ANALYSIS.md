# 🛡️ Análise de riscos do Bobby (RAG de currículo)

Documento vivo. Cada risco tem: **o que pode dar errado**, **probabilidade**, **impacto**, **mitigação aplicada** e **status**. Revisar a cada mudança grande na base.

> Regra geral do projeto: o Bobby fala em nome de uma pessoa real (um candidato). **Qualquer invenção, exagero ou vazamento é um dano reputacional**, não um bug de software.

---

## 1. Riscos de conteúdo (os mais graves)

| # | Risco | P | I | Mitigação | Status |
|---|---|---|---|---|---|
| 1.1 | **Vazamento de remuneração** (valor, faixa ou moeda escapar em qualquer caminho: entidade, órbita, deepening, KB, resposta composta) | Média | **Crítico** (viola política explícita do dono) | Tripla trava: (a) base auditada sem valores, (b) faceta `pretensao` responde só "a combinar", (c) `enforceSalaryPolicy()` aplicado a **toda** saída, cobrindo R$, dólar, "X mil", "3k" e vocabulário PT/EN | ✅ Mitigado (guard testado) |
| 1.2 | **Invenção de fato técnico** (o bot "completa" um detalhe que o Marcos não declarou: arquitetura interna, testes, prazos,engines) | Alta | **Crítico** | Regra editorial em 4 camadas: entidades só com fatos confirmados; detalhe ausente → resposta "não tenho esse detalhe confirmado"; superlativos exigem dados completos; deepening auditado (sem travessão, sem valor) | ✅ Mitigado por projeto |
| 1.3 | **Atribuir autoria errada** (dizer que ele digitou cada linha, ou que a IA fez tudo sozinha) | Média | Alto | Facet `ia_copiloto` em 3 órbitas; meta_ia separa "Bobby não gera texto" de "Marcos usa IA como copiloto"; respostas revisadas para não afirmar escrita manual | ✅ Mitigado |
| 1.4 | **Expor PCD/TEA/laudo de cara** (parecer "deficiente" no primeiro contato) | Baixa | Alto | Órbita `neurodivergencia` fala de **altas habilidades** por padrão; `vaga_afirmativa` (com laudo e lei) só quando perguntado; resposta começa valorizando; página e chips atualizados | ✅ Mitigado |
| 1.5 | **Inconsistência entre fontes** (mesma verdade escrita de jeitos diferentes em `entities.json`, `orbits.json`, `deepening/` e `knowledge_base.json`, e um dia divergirem) | Alta | Médio | Regra: `entities.json` é a fonte do fato por assunto; `orbits.json` é resumo; `deepening/` aprofunda; `knowledge_base.json` é fallback. Auditar com grep antes de cada deploy (comandos abaixo) | ⚠️ Processo (documentado) |
| 1.6 | **Tom robótico ou desalinhado** (travessão, termos que o dono não usa, risadas em excesso) | Média | Médio | Travessões removidos de toda a base; tom revisado; risadas raras e só em smalltalk | ✅ Mitigado |

## 2. Riscos de roteamento (a conversa "sair do trilho")

| # | Risco | P | I | Mitigação | Status |
|---|---|---|---|---|---|
| 2.1 | **Escolha de menu continuar no assunto anterior** (usuário diz "condições" e o bot continua falando de DirectSend) | Era alta | Alto | `topic_choices.json` + `resolveTopicChoice()` antes do contexto; a escolha limpa a entidade ativa; perguntas (com `?` ou verbo interrogativo) nunca são tratadas como escolha de menu | ✅ Mitigado (testado 4/4) |
| 2.2 | **Oferta de continuação sem rastreamento** (bot pergunta "quer aprofundar?" e não entende a resposta) | Era alta | Alto | `DialogState`: oferta registrada como pendente; resposta curta resolvida por rótulo, número, ordinal, sim/não; pergunta completa assume o fluxo normal | ✅ Mitigado (testado 16/16) |
| 2.3 | **Contexto pegajoso sequestrar** ("ele" ou pergunta curta herdando o projeto errado) | Média | Médio | Continuação só com marcador explícito ("e o desafio?") ou faceta reconhecida; tema trocado limpa a entidade | ✅ Mitigado |
| 2.4 | **Superlativo inventar ranking** ("mais recente", "maior", "mais demorado" com dados parciais) | Média | Alto | `resolveSuperlative` exige dados em **todos** os itens; senão, resposta explica a limitação; "maior desafio" não é confundido com "maior projeto" | ✅ Mitigado |
| 2.5 | **"Você" ambíguo** (recrutador fala do Marcos como "você": "você tem experiência com X?") | Média | Médio | Sinônimos mapeiam "você" para Bobby (meta_ia). Se a pergunta menciona tema do Marcos (projeto, stack), a órbita certa ainda vence pelo roteamento. **Risco conhecido**: em dúvida, o bot pode responder como Bobby | ⚠️ Conocido (documentado) |
| 2.6 | **Pergunta em inglês cair no "não sei"** | Média | Médio | Triggers em inglês adicionados às facetas de recrutamento (salário, remoto, disponibilidade, contratação, contato, fit, "can he code"); sinônimos PT/EN no guard de salário | ✅ Mitigado (básico) |
| 2.7 | **Repetição cansativa** (mesma variação voltando logo) | Média | Baixo | `SessionMemory.pick()` com anti-repetição por chave; temas sensíveis nunca usam a versão "repeti" | ✅ Mitigado |

## 3. Riscos de entrada (abuso e sujeira)

| # | Risco | P | I | Mitigação | Status |
|---|---|---|---|---|---|
| 3.1 | **Poluição por repetição** (letras ou números gigantes) | Alta | Baixo | `InputGuard`: 7+ caracteres iguais, padrão repetido, 7+ dígitos iguais, bloco de 18+ dígitos; risadas (`kkkk`, `hahaha`) isentas; limite de 400 no campo e 500 no guard | ✅ Mitigado (testado) |
| 3.2 | **Código colado para executar/avaliar** | Média | Médio | `InputGuard.looksLikeCode()` (heurística multi-sinal); **exceção**: código curto junto de uma pergunta passa (recrutador avaliando snippet do projeto) | ✅ Mitigado |
| 3.3 | **Tentativa de reprogramar o bot** ("ignore instruções", "system prompt", jailbreak) | Média | Alto | `InputGuard.looksLikeInjection()` bloqueia antes de qualquer busca; resposta institucional sem ecoar o comando | ✅ Mitigado (testado) |
| 3.4 | **Palavrão / abuso** | Média | Médio | `ProfanityFilter` (leet + espaçado) com escalonamento; provocação leve ("você é burro?") cai em `teste_bot`, com bom humor | ✅ Mitigado |
| 3.5 | **XSS via mensagem do usuário ou da base** | Baixa | Alto | `MessageFormatter` escapa HTML antes de converter markdown; links só `http(s)`; badge de fonte também escapado | ✅ Mitigado |

## 4. Riscos operacionais

| # | Risco | P | I | Mitigação | Status |
|---|---|---|---|---|---|
| 4.1 | **Um fetch 404 derrubar o motor inteiro** (ficar eternamente em "carregando inteligência...") | Era média | **Alto** | `loadJson()` com fallback no ranker + `try/catch` próprio no `init()` de facet_detector, entity_resolver, orbit_router e dialog_state; cada módulo degrada sozinho | ✅ Mitigado |
| 4.2 | **Bundle pesado demais para mobile** | Média | Médio | Tudo é JSON/JS estático servido com gzip; medir com `du -sh` a cada release (veja §5). Se crescer muito, dividir `deepening/` por lazy-load por órbita | ⚠️ Monitorar (§5) |
| 4.3 | **Dados desatualizados** (link novo, projeto publicado, novo emprego) | Alta | Médio | Uma pessoa só edita (o dono); checklist de deploy no `README_INSTALL.md`; telemetria opcional mostra o que recrutadores perguntam e o que faltou (`/api/insights`) | ⚠️ Processo |
| 4.4 | **Telemetria coletar dado pessoal sem querer** | Baixa | Médio | Nada é persistido no navegador; telemetria é opcional, desliga em `RAG_CONFIG`; payload documentado em `README_INSTALL.md` §5 | ✅ Mitigado |
| 4.5 | **Duas abas / recarregar no meio da conversa** | Alta | Baixo | Memória é por sessão (só RAM); ao recarregar, a conversa reinicia com saudação e menu — comportamento previsível | ✅ Aceito |
| 4.6 | **Erros de runtime no meio da conversa** | Baixa | Alto | `chat_agent` envolve `ranker.answer()` em try/catch e responde com fallback + contato do Marcos; telemetria nunca quebra o chat | ✅ Mitigado |
| 4.7 | **Gerador de perguntas desatualizado** (editar `orbits/entities/facets` e esquecer de regerar `questions/`) | Média | Médio | `questions/` é gerado e marcado como "não editar"; comando de regeneração documentado em 3 READMEs; PR check pode rodar `node tools/build_question_bank.mjs` e falhar se houver diff | ⚠️ Processo |

---

## 5. Métricas para monitorar

```bash
# Tamanho total do bundle servido
du -sh public/chat-rag
du -sh public/chat-rag/rag/mesh/questions public/chat-rag/rag/mesh/deepening

# Auditoria de remuneração (deve retornar vazio)
grep -rniE 'r\$|\$ ?[0-9]|[0-9] ?reais|[0-9](\.[0-9]+)? ?k\b' \
  public/chat-rag/data public/chat-rag/rag --include=*.json | grep -v questions/

# Auditoria de travessão em respostas (deve retornar vazio)
grep -rn '—' public/chat-rag/data public/chat-rag/rag/mesh/orbits.json \
  public/chat-rag/rag/mesh/deepening public/chat-rag/rag/responses --include=*.json

# Estrutura das árvores de aprofundamento (deve ser 15+10+10+10+5 em todas)
python3 - <<'PY'
import json, glob
for f in sorted(glob.glob('public/chat-rag/rag/mesh/deepening/*.json')):
    if f.endswith('manifest.json'): continue
    d = json.load(open(f))
    layers = {}
    for n in d['nodes']: layers[n['layer']] = layers.get(n['layer'], 0) + 1
    print(f.split('/')[-1], [layers.get(i, 0) for i in (1,2,3,4,5)])
PY
```

## 6. O que NÃO foi mitigado (decisão consciente)

- **Perguntas em idiomas além de PT/EN** caem na resposta sagrada (honesta) em vez de tradução automática (que poderia inventar).
- **A memória não persiste entre sessões**: é escolha de privacidade, não limitação técnica.
- **O bot não opina sobre "o mercado"** (ex.: "seu salário está baixo"): fora do escopo do currículo.
- **A IA como copiloto não é quantificada** ("quanto % a IA escreveu?"): o Marcos não mátrica isso, e o bot não inventa número.

## 7. Checklist antes de cada deploy

1. `node tools/build_question_bank.mjs` (se mudou órbitas/entidades/facets/templates)
2. `node tools/test_engine.mjs` + `BATCH=CHOICE` + `BATCH=DIALOG` + `BATCH=RISK`
3. Auditoria de remuneração (§5) — tem que voltar vazia
4. Auditoria de travessão (§5) — tem que voltar vazia
5. `du -sh` do bundle — anotar crescimento
6. Abrir `demo.html`, testar: troca de tema, escolha por número, study case de um jogo, uma pergunta fora da base


---

# Rodada 2: testes, provocação e becos sem saída

Esta rodada nasceu de uma observação do dono: um recrutador de TI gosta de futricar, repetir, testar a lógica das respostas e ver se o candidato foi inteligente. O chat também é um alvo de teste. Tudo abaixo é verificado pelo testador de stress (§ 9).

## 6. Riscos de interação com testadores

| # | Risco | P | I | Mitigação | Status |
|---|---|---|---|---|---|
| 6.1 | **Beco sem saída** (a resposta termina e a conversa morre: "ok", "gostei", "obrigado", "não sei") | Alta | Alto | `ensureForwardPath()` em `answer()`: toda resposta, exceto despedida e reinício, deixa uma oferta de continuação **rastreada** (`pendingOffer`). Invariante do stress: 0 becos em 2.600+ perguntas | ✅ Mitigado |
| 6.2 | **Entradas curtas de teste** ("DEBUG", "SOLTO?", "ok", "gostei", "ping", "mentira", "repete") caírem no "não sei" ou em resposta aleatória | Alta | Médio | `ReactionEngine`: reações com humor e caminho (debug, solto, gostei, teste, ping, doubt, repeat, humano, recomendação) + respostas vagas em 3 baldes (positivo, mais, incerto) | ✅ Mitigado |
| 6.3 | **Palavras quentes** ("SOCRAM", "LAR", "hiperfoco", "sapo", "metralhadora") ignoradas | Média | Médio | `mesh/hot_words.json` leva direto ao nó de aprofundamento; variantes com contexto ("socram foge?") têm prioridade | ✅ Mitigado |
| 6.4 | **Palavrão disfarçado** (p0rr4, f.d.p, c4r4lh0, p o r r a, poooorra, frase letra a letra) | Alta | Médio | `LeetNormalizer` converte leet **por palavra**; `ProfanityFilter` junta letras separadas, colapsa repetições e compara com fronteira de palavra (sem acusar "computador" por "puta") | ✅ Mitigado (12 variações testadas) |
| 6.5 | **Escalada sem consequência** | Média | Médio | Escada por contagem: 1 aviso leve ("se é teste, fui configurado bem"), 2 "ainda testando?", 3 **reinicia o chat** (campo travado por ~3,6 s, memória apagada). Quem reincide depois do reset começa no nível 2 | ✅ Mitigado |
| 6.6 | **Crítica ao candidato** ("esse cara é péssimo") respondida com defesa ou com ofensa | Média | Alto | `hostility.json`: 3 respostas calmas com fatos, links e o contato; na 4ª ocorrência entra na escada de moderação. Pergunta legítima sobre limitações ("pontos fracos?") **não** é hostilidade | ✅ Mitigado |
| 6.7 | **Loop de vagos** ("ok", "ok", "ok"...) com texto idêntico | Média | Baixo | Anti-repetição por chave + oferta que muda conforme o contexto | ✅ Mitigado |
| 6.8 | **Pergunta em inglês** | Média | Médio | Vocabulário de função em inglês, sinônimos EN para os temas, aviso único "respondo em português" | ✅ Mitigado (básico) |
| 6.9 | **Formato de entrada hostil** (`<script>`, SQL, comando, injeção de prompt) | Média | Alto | `InputGuard` com padrões inequívocos que bloqueiam sozinhos; código curto junto de uma pergunta continua passando | ✅ Mitigado |

## 7. Riscos de conteúdo encontrados pelo stress e pela sonda

| # | Risco | Como foi achado | Mitigação | Status |
|---|---|---|---|---|
| 7.1 | **Afirmação falsa por sequestro de nó**: "ele sabe Excel/Python/PHP/Firebase?" respondia "Sim, e de forma comprovada: foi instrutor…" (nó de comunicação) | Sonda independente | Variação de uma palavra só vale por texto idêntico; casamento exige palavra distintiva; "você" vira sinal (chat) versus "ele" (Marcos); sinônimo não cobre pronome | ✅ Corrigido |
| 7.2 | **Resposta genérica para qualquer coisa** ("Ele não vem do zero…") | Sonda | `retrieveFallback()`: busca léxica em **todas** as respostas (nós, satélites, órbitas), preferindo trecho curto e focado e a órbita provável; termo que não existe em nenhuma resposta vira "não tenho registro de X" com caminhos reais | ✅ Corrigido |
| 7.3 | **"Com certeza" sem base** ("ele aceita viajar?") | Sonda | Faceta de viagem removida de `modelo_trabalho`; FAQ honesto | ✅ Corrigido |
| 7.4 | **Lore trocado**: SOCRAM "foge" | Dono | SOCRAM é **derrotado** no primeiro jogo; quem foge é o **Bobby** de foguete; o exército dele dura mais 2 jogos, como um mito a ser vingado. Invariante de stress bloqueia "SOCRAM foge" | ✅ Corrigido |
| 7.5 | **Anos de fábrica subestimados** | Dono | Cerca de **8 anos de fábrica (2015 a 2023)**; Bella Arte segue como a mais longa numa só empresa (5a4m) | ⚠️ Ver 7.9 |
| 7.6 | **Inglês superestimado** ("intermediário", "fluente") | Dono | Não fala inglês, sabe se virar; estuda por imersão (séries com áudio em inglês), gosta de morfologia e etimologia, não se considera intermediário. Invariante bloqueia "inglês fluente/intermediário/avançado" | ✅ Corrigido |
| 7.7 | **Tom de candidato desesperado** ("busca a primeira posição formal") | Dono | Conversa de igual para igual: "está de olho em suporte, QA, análise e dev, pode começar já". Invariante bloqueia "primeira posição" | ✅ Corrigido |
| 7.8 | **Regime de contratação (CLT/PJ)** citado sem necessidade | Dono | Removido de todas as respostas; invariante bloqueia | ✅ Corrigido |
| 7.9 | **Datas conflitantes**: o currículo diz Bella Arte até fev/2024 (5a4m); o dono fala que saiu da fábrica em 2023 | Revisão | O agregado usa "cerca de 8 anos, de 2015 a 2023"; as respostas da Bella Arte seguem o currículo. **Confirmar com o dono qual data vale e alinhar `entities.json` e `deepening/experiencia.json`** | ⚠️ Pendente do dono |
| 7.10 | **Pergunta pessoal** (filhos, estado civil, signo, medo) | Sonda | FAQ honesto: "isso é pessoal e não está na base" | ✅ Mitigado |

## 8. Riscos que continuam abertos (decisão consciente)

- **Falso positivo da busca léxica**: uma palavra rara pode puxar um trecho vizinho semanticamente (ex.: "teste" puxando "teste de integração do DirectSend"). Mitigação parcial: variações autoradas para as perguntas mais prováveis, trecho curto preferido e órbita provável como desempate. Monitorar o relatório da sonda.
- **Respostas honestas de "sem dado"** em perguntas que o recrutador acha básicas (matemática, hobby, tipo de roteador). É o comportamento desejado: nunca inventar. A lista cresce com a telemetria (`/api/insights`).
- **Reset como punição**: quem abre outra aba recomeça do nível 1. Aceito: o chat não guarda nada no navegador.
- **Idioma**: perguntas em inglês são entendidas em nível básico; outros idiomas caem na resposta honesta.

## 9. Testador de stress

```bash
node tools/stress_test.mjs        # relatório em tools/reports/stress_report.md
```

Cobertura da última execução: **2.676 perguntas**, ~2,8 ms por resposta.

| Fonte | O que testa |
|---|---|
| A: auto-recall | Toda pergunta e variação dos 605+ nós acha o próprio nó (98,1% exato; o restante é interceptado de propósito por reação ou palavra quente) |
| B: geradas | 450 perguntas montadas dos templates (0 em "desconhecido") |
| C: curadas | 186 casos: recrutador, erro de digitação, inglês, vagos, reações, palavra quente, higiene de entrada, palavrão disfarçado, hostilidade, fora de escopo |
| D: cenários | 22 fluxos multi-turno: escada de moderação, hostilidade, sequência DEBUG/SOLTO/Ok/Gostei, oferta por número, loops, inglês, lore, regime |
| E: sonda | 115 perguntas independentes de recrutador futricando; lista as que ficaram sem dado, fora de escopo ou genéricas |

Invariantes verificadas em **todas** as respostas: sem CLT/PJ, sem valor monetário, sem "primeira posição", lore do SOCRAM correto, sem "inglês fluente/intermediário", sem travessão, sem placeholder, sem exceção e **sem beco sem saída**.

Complementam: `BATCH=CHOICE|DIALOG|RISK node tools/test_engine.mjs` e a lista de comandos de auditoria do §5.
