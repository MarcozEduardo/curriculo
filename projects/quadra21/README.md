# Quadra 21 – Barra Pesada

Beat'em up em TypeScript + Canvas 2D com editor visual de fases próprio.

## Estrutura de arquivos

```
quadra21/
├── capa/
│   └── cover.png              ← capa (aparece se não tiver vídeo)
├── screenshots/
│   ├── 01.png
│   ├── 02.png
│   └── 03.png
├── info.json
└── README.md
```

## Como editar

1. **Adicionar capa:** joga em `capa/cover.png` e ajusta `media.capa` no `info.json`
2. **Adicionar prints:** joga em `screenshots/` e atualiza `media.prints`
3. **Adicionar vídeo:** coloca o link do Google Drive em `media.drive`
4. **Se faltar arquivo**, o modal cai no placeholder colorido automaticamente
