# Módulos JavaScript - Currículo & Chatbot

Esta pasta contém os scripts que dão vida à interface, ao motor de geração de PDF e à inteligência do assistente Bobby.

## 📄 Arquivos e Responsabilidades

- `ui.js` -> Gerencia interações do usuário: cópia de dados para área de transferência (toasts), modal de confirmação do LinkedIn, sticky mini-header, abas de navegação (IntersectionObserver/scroll spy) e disparo do gerador de PDF A4 em alta definição.
- `rag_engine.js` -> Motor de busca semântica e recuperação vetorial/BM25 client-side. Tokeniza termos, remove stopwords em português, calcula pontuação de relevância (TF-IDF + keywords + títulos) e retorna os Top-K chunks da base de conhecimento.
- `chat_agent.js` -> Orquestrador do Chatbot Bobby. Trata mensagens do visitante, consulta o `RagEngine`, sintetiza respostas com citações de fonte (badge visual), simula indicador de digitação e preserva os easter eggs de desvio de script (`offScriptCount`).
