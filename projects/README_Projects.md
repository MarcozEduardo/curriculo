# 📁 Galeria de Projetos

Cada subpasta é UM projeto. Contém mídia própria + `info.json` com metadados.

## 📂 Como Adicionar um Projeto Novo

1. Copia `_template/` → renomeia pra `projects/<id-do-projeto>/`
2. Coloca mídia nas subpastas:
   - `video/` → arquivo `.mp4` (opcional, só o primeiro é usado)
   - `capa/` → arquivo `.jpg` ou `.png` (usado se não tiver vídeo)
   - `screenshots/` → quantas `.jpg`/`.png` quiser (usadas como galeria)
3. Edita `info.json` da pasta pra apontar os nomes dos arquivos
4. Adiciona entrada em `data/projects_media.json` com o mesmo `id`
5. Pronto. **Não precisa mexer em HTML, CSS ou JS.**

## 📄 Estrutura de Cada Pasta

```
projects/
├── README_Projects.md        ← este arquivo
├── _template/                ← copie este quando criar projeto novo
│   ├── README.md
│   └── info.json
└── <id-do-projeto>/
    ├── README.md
    ├── info.json
    ├── video/
    ├── capa/
    └── screenshots/
```

## ⚠️ Regras

1. **Nomes de arquivo sem espaço, sem acento, minúsculo.** Use `-` no lugar de espaço.
2. **Não mexe no `pdf-mode.js`.** Esta pasta é 100% isolada do PDF.
3. **Ordem dos prints** = ordem no array `prints` do `info.json`.
4. **Se um arquivo não existir**, o modal mostra um placeholder colorido no lugar.

## 🎨 Placeholders de Demo

Quando `media.demo: true` no `info.json`, o modal renderiza cores:
- 🔵 Azul = vídeo
- 🟢 Verde = capa
- 🟡 Amarelo = print 1
- 🟣 Roxo = print 2
- 🟠 Laranja = print 3
