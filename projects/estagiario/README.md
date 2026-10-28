# O Estagiário

RPG isométrico em TypeScript com editor de cenários próprio.

## Estrutura de arquivos

```
estagiario/
├── capa/
│   └── cover.png              ← capa (opcional, se não tiver vídeo)
├── screenshots/
│   ├── Screenshot_1.png
│   ├── Screenshot_2.png
│   └── Screenshot_3.png
├── info.json
└── README.md
```

## Como editar

1. **Adicionar/trocar capa:** joga em `capa/cover.png` e ajusta `media.capa` no `info.json`
2. **Adicionar prints:** joga em `screenshots/` e atualiza `media.prints`
3. **Adicionar vídeo:** coloca o link do Google Drive em `media.drive`
4. **Se faltar arquivo**, o modal cai no placeholder colorido automaticamente
