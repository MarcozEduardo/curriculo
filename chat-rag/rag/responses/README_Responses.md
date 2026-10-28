# 💬 Respostas — comportamento conversacional

> ⚠️ **Migração v3:** o conteúdo factual (sobre, skills, projetos, experiência, contato, PCD, FAQ de recrutador) saiu daqui e virou **órbitas e facetas** em `rag/mesh/orbits.json` + `data/entities.json`. Esta pasta guarda agora só o **comportamento** do bot.

| Arquivo | Quando é usado |
|---|---|
| `greeting.json` | Saudações; variações com nome do visitante e por período do dia |
| `smalltalk.json` | "tudo bem?", agradecimento, despedida, elogio, piada, ajuda/menu |
| `user_identity.json` | O visitante fala de si: "você sabe quem eu sou?", apresentação, empresa, teste do bot |
| `unknown_sacred.json` | **Resposta sagrada**: não há dado na base. Escalona em 4 níveis conforme a insistência |
| `off_topic.json` | Assunto claramente fora do escopo (clima, futebol, receita, política) |
| `repeat_detection.json` | Mesma pergunta/intenção repetida — responde em versão curta + desvio |
| `profanity_response.json` | Moderação, com `escalada` para reincidência |
| `correction.json` | Usuário corrige o bot ("não, eu disse Marketbobby") |
| `polarity.json` | Peso do sim/não/talvez: prefixos e respostas soltas |
| `humanizer.json` | Aberturas, baixa confiança e ambiguidade (transições soltas foram desativadas: toda pergunta de continuação é rastreada pelo DialogState) |
| `dialog_followups.json` | Moldes de oferta de continuação, re-pergunta, recusa, retomada e rótulos legíveis de facetas |
| `reactions.json` | Reações a teste e respostas vagas (debug, solto, gostei, teste, ping, doubt, repeat, humano, recomendação; vagos positivo/mais/incerto) |
| `hostility.json` | Crítica ao candidato ou ao chat: 3 níveis calmos com fatos e contato; 4ª ocorrência vira escada de moderação |
| `profanity_response.json` | Escada de moderação: 1 aviso leve, 2 "ainda testando?", 3 reinício do chat |
| `input_guard.json` | Respostas do filtro de entrada (repetição, números, código, injeção, comprimento) |

---

## Placeholders suportados

`{nome}` · `{empresa}` · `{saudacao}` · `{entidade}` · `{resumo}` · `{sugestao}` · `{opcoes}`

## Regras

- **Deps:** nenhuma (JSON puro). **UsedBy:** `engine/ranker.js`, `engine/humanizer.js`, `engine/polarity.js`.
- Toda lista de variações passa por `SessionMemory.pick()` → não repete enquanto houver opção nova.
- Para adicionar um arquivo novo, registre o nome no array `files` de `engine/ranker.js` (`init()`).
- Nunca escreva resposta que afirme algo que não está em `data/entities.json` / `mesh/orbits.json`.
