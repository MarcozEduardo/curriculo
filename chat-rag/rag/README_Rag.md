# 🧩 Motor RAG — arquitetura

Busca semântica, NLP leve, moderação e síntese de respostas para o chat Bobby. Tudo client-side, em JavaScript puro.

```text
rag/
├── config.js        # base de URL (RAG_URL), versão, telemetria, limiares
├── mesh/            # ★ órbitas, facetas, templates e banco gerado de perguntas
├── engine/          # 12 módulos do motor (ver README_Engine.md)
├── dictionary/      # stopwords, sinônimos, palavrões, termos de RH
├── filters/         # moderação
├── responses/       # comportamento conversacional (JSON)
└── templates/       # moldes de frase reutilizáveis
```

## Princípios

1. **Não inventar.** Sem dado na base ⇒ resposta sagrada (`responses/unknown_sacred.json`).
2. **Modularidade.** Cada camada tem uma responsabilidade e um README.
3. **Dados fora do código.** Resposta nova = JSON novo, nunca `if` novo.
4. **Tolerância ao humano.** Erro de digitação, gíria, leetspeak, acento ausente e correção no meio da conversa.
5. **Memória curta e honesta.** Lembra o que você disse na sessão; nada é persistido no navegador.

## Limiares (ajustáveis em `config.js`)

| Chave | Default | Efeito |
|---|---|---|
| `minConfidence` | 2.2 | Score mínimo do fallback de knowledge base |
| `ambiguityDelta` | 0.8 | Diferença máxima entre 1ª e 2ª órbita para considerar ambíguo |
| `typingDelay` | [320, 720] | Faixa do "digitando..." |
| `telemetryEnabled` | true | Envia a interação para `/api/chat/log` |
