# 🌳 Árvores de aprofundamento (sub-assuntos)

Cada órbita tem um arquivo aqui com **50 perguntas e respostas encadeadas** na estrutura **15 + 10 + 10 + 10 + 5**:

| Camada | Nós | O que é |
|---|---|---|
| 1 | 15 | Perguntas diretas sobre a resposta principal do tema |
| 2 | 10 | Perguntas sobre as respostas da camada 1 |
| 3 | 10 | Perguntas sobre as respostas da camada 2 |
| 4 | 10 | Perguntas sobre as respostas da camada 3 |
| 5 | 5 | Perguntas sobre as respostas da camada 4 |

Total atual: **11 árvores × 50 = 550 nós** (ver `manifest.json`).

---

## Por que existe

Para que a conversa **não mude de assunto do nada**. Quando o Bobby responde um nó, ele oferece os filhos desse nó ("Posso seguir por A, B ou C"), guarda a oferta como pendente e entende a resposta curta do visitante:

- pelo rótulo (`"a Bella Arte"`), por número (`"2"`), por ordinal (`"a primeira"`),
- `"sim"` (se houver uma opção) ou pedido de escolha (se houver várias),
- `"não"` (desvia com os temas principais),
- erro de digitação tolerado.

Se o visitante digitar uma pergunta completa, o roteamento normal assume; a oferta pendente é substituída pela próxima.

---

## Formato de um nó

```json
{
  "id": "pr16",
  "layer": 2,
  "parent": "pr01",
  "label": "A Fuga de Bobby",
  "question": "O que acontece em A Fuga de Bobby?",
  "variants": ["como é o jogo a fuga de bobby", "do que se trata a fuga"],
  "answer": "É uma plataforma retrô: ...",
  "facet": "resumo",
  "entity": "proj_fuga_bobby"
}
```

| Campo | Obrigatório | Uso |
|---|---|---|
| `id` | sim | Prefixo de 2 letras da órbita + número (`pr`, `sk`, `ex`, `fo`, `nd`, `rc`, `sm`, `hp`, `tr`, `mi`, `ct`) |
| `layer` | sim | 1 a 5 |
| `parent` | sim | `null` na camada 1; id de um nó da camada anterior nas demais |
| `label` | sim | Rótulo curto usado na oferta ("Posso seguir por **{label}**") |
| `question` | sim | Pergunta canônica |
| `variants` | não | Outras formas de perguntar (alimentam o casamento fuzzy) |
| `answer` | sim | Resposta, só com fatos confirmados pelo Marcos |
| `facet` | não | Faceta que o nó responde (evita conflito com facetas sensíveis) |
| `entity` | não | Satélite ao qual o nó pertence (prioriza o nó quando a entidade está ativa) |

---

## Como o motor usa (engine/dialog_state.js)

1. **Casamento de pergunta**: tokens da pergunta do visitante × tokens de `question`/`variants`, com cobertura exigida nos dois sentidos (≥ 70 % do nó e ≥ 65 % do que o visitante escreveu) e fuzzy para erro de digitação. Superlativos comparativos ("mais demorado") e facetas sensíveis (remuneração, vaga afirmativa, copiloto) têm prioridade sobre o nó.
2. **Oferta**: filhos não respondidos do nó → facetas restantes do satélite → raízes não respondidas da órbita, em rotação. Máximo de 3 opções.
3. **Memória**: `askedNodes` evita repetir o mesmo nó; se repetir, o Bobby avisa ("Retomando o que já comentei").

---

## Como adicionar uma árvore nova

1. Criar `rag/mesh/deepening/<orbita>.json` com `orbit`, `label` e `nodes` na estrutura 15+10+10+10+5.
2. Adicionar o nome do arquivo em `manifest.json` (`files`).
3. Validar: ids únicos, `parent` existente e da mesma órbita, sem travessão, sem valor monetário.
4. Rodar `BATCH=DIALOG node tools/test_engine.mjs`.

Regra editorial: **nenhuma resposta pode afirmar o que o Marcos não declarou**. Quando a base não tem o detalhe, a resposta diz isso (veja exemplos como `pr36`, `pr49`, `fo45`).


---

## Arquivos adicionais

- `curiosidades.json` (órbita **curiosidades**, prefixo `cu`): SOCRAM e a saga, como este chat foi feito, o que acontece com palavrão ou crítica, curiosidades do Marcos. Mesma estrutura 15+10+10+10+5.
- `../faq_extra.json` (**layer 0**, prefixo `fq`): perguntas de recrutador que futrica (lacuna, demissão, Scrum, viagem, horário, Excel, linguagens, segurança, "maior erro"...). Não fazem parte das árvores nem são oferecidas como raiz; só respondem quando a pergunta casa. Regra: só fato confirmado; sem dado, a resposta diz isso e mostra o que existe.
- Palavras quentes (`../hot_words.json`) apontam direto para nós destas árvores.
