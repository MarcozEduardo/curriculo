# Dama Orbital

Dama multiplayer em TypeScript + WebRTC + Firebase. Batalha final da trilogia Bobby.

## Estrutura de arquivos

```
dama-orbital/
├── capa/
│   └── CapaDama.png          ← capa do vídeo (aparece com botão play)
├── screenshots/
│   ├── FightDama.png          ← print 1
│   ├── FightDama2.png         ← print 2
│   └── FightDama3.png         ← print 3
├── info.json
└── README.md
```

## Como editar

1. **Adicionar/trocar capa:** joga a imagem em `capa/` e atualiza `media.capa` no `info.json`
2. **Adicionar/trocar prints:** joga em `screenshots/` e atualiza `media.prints` no `info.json`
3. **Adicionar vídeo:** coloca o link do Google Drive em `media.drive`
4. **Se faltar arquivo**, o modal cai no placeholder colorido automaticamente
