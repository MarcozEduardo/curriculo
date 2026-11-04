# NÚCLEO PRIME · PENDÊNCIAS E DIAGNÓSTICO

> Documento de handoff. Escrito em 04/11/2026 após investigação do motor vetorial.
> Objetivo: próxima IA (ou o próprio Marcão) entender o estado real do RAG antes de tocar.

---

## 1. DIAGNÓSTICO: por que o RAG vetorial erra em contexto específico

### Sintoma observado

Usuário está falando de **Marketbobby** (lista de mercado). Em um turno depois, diz:

> "Tava lembrando dos personagens. Quais personagens são?"

Bob responde: **"Sobre personagens eu não tenho registro na base do Marcos..."** (fora da base).

Mas `personagens` **existe** — está em `deepening/projetos.json`, node `pr57` (Lelecriando → personagens).

### Causa raiz

**O motor NÃO faz busca cross-orbit.** Quando a palavra-alvo não está na órbita ativa, ele não varre as outras 16 antes de desistir.

Fluxo real em `ranker.js` (linha ~616):

```js
if (coverage.unknownStrong.length > 0 || (coverage.total >= 2 && coverage.ratio < 0.45)) {
  return this.sacredUnknown(raw);  // ← morre aqui
}
```

`lexicalCoverage` só consulta o vocabulário global (`dialog.vocab`, `router.inverted`, `entities.tokenFreq`, etc). Se `personagens` não bateu no vocabulário indexado, cai em `unknownStrong` → **`sacredUnknown` sem sequer tentar as outras órbitas**. `retrieveFallback` (linha 871-923) só roda se NÃO caiu no `sacredUnknown` — ou seja, a busca cross-orbit **nunca acontece** nesse caso.

### Problema maior: base de dados é produto cartesiano gerado por IA

Exemplo de `questions/contato.json` (420 entries):

```
1 | default | - | como detalhes contato
2 | default | - | voce sabe sobre contato
5 | resumo | - | falar telefone
7 | entrevista | - | voce sabe saber contato
...
26 | entrevista | - | falar fala sobre contato
```

**Padrão:** `12 prefixos × 9 alvos × 4 facetas` = ~420 combinações.

**Problemas:**
- `saber saber contato` (prefixo duplicado, gramática quebrada)
- `explica email mim` (sem sentido)
- `como seria contato` (vazio)
- Faceta aleatória: `saber bastidores whatsapp` marcado como `entrevista`

**Consequência:** o motor vetorial casa **frase inteira que existe**. Então:

```
user: "Você pode até falar do personagem, mas fala sobre a história"
tokenizer → [voce, pode, ate, falar, personagem, mas, fala, sobre, historia]
```

`fala sobre` casa com `fala sobre contato`, `falar sobre contato`, etc. **Não existe** `fala sobre historia` na base. O motor devolve o match de maior comprimento → `contato`.

### Confirmação de entendimento

O motor vetorial funciona assim:

1. Numera cada palavra da base (bag of words)
2. Recebe input do usuário, tokeniza
3. Busca nas entradas pré-geradas a que tem **mais overlap de tokens**
4. Devolve a resposta associada àquela entrada

**O motor não entende intenção.** Ele só casa padrão. Isso funciona pra frases bem cobertas pela base (que é enorme), mas falha em:
- Frase natural com verbo + preposição de um tema e substantivo de outro
- Palavra que não está indexada no vocabulário global
- Contexto vivo que muda entre turnos

---

## 2. O QUE CONSERTAR (próximo RAG, não este)

O RAG semântico (`ProjetoNovoRag/`) resolve essa raiz porque:
- Entende o **sentido** de cada palavra (não só casamento de tokens)
- Interpreta função sintática (verbo, substantivo, artigo, preposição)
- Mantém contexto vivo sem depender de match exato

**NÃO TENTAR CONSERTAR NO VETORIAL.** A base de 5249 entries cartesianas vai sempre produzir resultado torto em frase natural. Qualquer "fix" no motor é creme dental na rachadura.

### Coisas que o motor vetorial ainda PODE melhorar (sem refazer base):

1. **Cross-orbit search** no fallback — quando `sacredUnknown` vai disparar, antes procurar em TODAS as órbitas. Pode encontrar o assunto real em outra órbita e fazer uma ponte honesta: "não falei disso nesta sessão, mas tenho registro em {orbita}. Segue: ..."
2. **Contexto com decay por turno** — fila do pastel (ver seção 3).
3. **Detecção de ambiguidade** — quando 2 nós casam com score similar (delta < 0.15), perguntar "falei de X e Y. Qual dos dois?"

---

## 3. FILA DO PASTEL (contexto vivo com prioridade temporal)

Analogia do Marcão: numa fila de pastel, se chega uma bandeja de carne, os primeiros da fila que não querem carne deixam passar quem quer. Mas o mais **recente** tem prioridade natural.

### Regra

- Cada `history[i]` tem peso = `1 / (1 + (turn_atual - turn_i) * 0.3)`
- Cada `topicCount[slug]` **decai** por turno (hoje só soma)
- Quando há match, prioriza o **contexto mais recente** dentro do threshold
- Se 2 matches com delta < 0.15, pergunta qual
- Se usuário diz "não era isso / errou aí", invalida o último nó e pede esclarecimento

### Onde tocar (não implementado)

- `memory.js`: decay de `topicCount`, helper `getContextWeight(slug)`
- `ranker.js`: alterar critério de escolha do hit (linha ~920 onde `score` é calculado)
- `dialog_state.js`: `pendingOffer` com TTL (turn + 2)

**Não implementado nesta sessão.** Marcão aprovou o conceito mas não autorizou patch.

---

## 4. ESTADO DE HOJE (o que foi feito)

- Núcleo Prime entregue: chip clicável no header, canvas 2D animado, 17 órbitas visíveis, cascade, sparks, fullscreen, mobile responsivo.
- 6 nós novos adicionados em `meta_ia.json`: mi51-mi57 (RAG vetorial, semântico, Núcleo Prime, botão, ambiguidade, 12 vs 17, abrir pelo chat).
- 5 nós novos em `projetos.json`: pr56-pr60 (Lelecriando: origem, personagens, músicas, legado, status).
- 33 verbos de fala adicionados em `hot_words.json` `filler[]` (`falou`, `mencionou`, `mostrou`, `disse`, etc).
- Detector atômico em `chat_agent.js`: `Cliquei no neurônio "X"` força contexto da órbita dona.

---

## 5. PENDÊNCIAS PRA PRÓXIMA IA

- [ ] Substituir `NÚCLEO NEXUS` por `NÚCLEO PRIME` no iframe (top bar, chip footer) — feito nesta sessão? Ver `nucleo.html`.
- [ ] Fila do pastel (contexto com decay).
- [ ] Cross-orbit search no fallback.
- [ ] Detecção de ambiguidade com pergunta de dúvida.
- [ ] Reformular base de `questions/*.json` (produto cartesiano gerado por IA). Ou aceitar que só o semântico resolve.
- [ ] Split `neurodivergencia.json` (cosmético, +2189 linhas de reformatação pendentes).

---

## 6. LEITURA RECOMENDADA

- `chat-rag/rag/engine/ranker.js` — método `answer()` linha 181, `lexicalCoverage` linha 1609, `sacredUnknown` linha 1595, `retrieveFallback` linha 871
- `chat-rag/rag/engine/memory.js` — `record()`, `topicCount`, `activeOrbit`
- `chat-rag/rag/engine/dialog_state.js` — `setPending()`, `pendingOffer`, `pendingTurn`
- `chat-rag/rag/mesh/questions/contato.json` — amostra do problema (420 entries cartesianas)
- `chat-rag/rag/mesh/deepening/*.json` — base real das respostas, formato estruturado (nodes com parent/layer/facet)
