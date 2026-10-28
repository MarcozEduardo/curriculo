# 💬 Camada de interface do chat (Bobby)

Visual e interação, totalmente desacoplados do motor RAG.

### `chat_agent.js`
- **Função:** ciclo de vida do chat no DOM — abrir/fechar modal (clique, ESC, clique fora), enviar mensagem, indicador "digitando", chips de sugestão iniciais, badge de fonte e telemetria opcional.
- **Deps:** `window.RagRanker`, `window.MessageFormatter`, `window.RAG_CONFIG`.
- **UsedBy:** página hospedeira (`demo.html`, `src/components/chat-mount.tsx`).
- **API pública:** `window.BobbyChat.open() | close() | ask("pergunta") | ranker`.
- **Resiliência:** inicia o motor em segundo plano; se o usuário enviar antes do fim do boot, a mensagem espera o `init()`. Erro em `answer()` nunca quebra a UI.
- **Telemetria:** `POST {telemetryEndpoint}` com pergunta, resposta, órbita, faceta, entidade e confiança — falha silenciosa por design.

### `message_formatter.js`
- **Função:** markdown mínimo e seguro → HTML. Escapa HTML primeiro, depois converte `**negrito**`, `*itálico*`, `` `código` ``, listas `•`/`-`, links `[texto](url)` e URLs soltas.
- **Deps:** nenhuma. **UsedBy:** `chat_agent.js`.

### `chat.css`
- **Função:** identidade laranja/creme do currículo: launcher flutuante, modal responsivo (full-screen no mobile via `100dvh`), balões, chips, badge de fonte e animação de digitação.
- **Variáveis exigidas:** `--orange`, `--orange-dark`, `--orange-deep`, `--cream`, `--ink`.
- **Acessibilidade:** `role="dialog"`, `aria-modal`, foco automático no input, fechamento por ESC e `focus-visible` no launcher.
