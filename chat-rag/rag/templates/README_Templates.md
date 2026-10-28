# 🧱 Templates de resposta

`response_templates.json` guarda **moldes de frase** reaproveitados pelo motor na hora de montar respostas compostas:

- `superlativos` — frases de "o maior / o mais recente / o mais rápido…" usadas junto com a resposta da entidade vencedora (`engine/ranker.js` → `composeAnswer`)
- `ranking` — lista dos 3 primeiros do superlativo
- `comparacao` — comparação entre dois satélites
- `encaminhamento` — blocos de contato reutilizáveis
- `fonte` — formato do badge mostrado no balão (`Órbita · Entidade`)
- `fechos` — frases de continuidade

**Deps:** nenhuma. **UsedBy:** `engine/ranker.js` (composição) e `engine/humanizer.js` (fechos).

Para mudar o tom de todas as respostas compostas, edite aqui — não no código.
