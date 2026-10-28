# Template de Projeto

Copie esta pasta e renomeie pra `projects/<id-do-projeto>/`.

## Estrutura

- `video/` — coloca o vídeo (`.mp4`). Se vazio, cai pra capa.
- `capa/` — coloca a imagem de capa. Se vazio, cai pro primeiro print.
- `screenshots/` — coloca os prints numerados (`01.jpg`, `02.jpg`, ...).

## info.json

Edite os campos:
- `id` — mesmo nome da pasta
- `nome` / `subtitulo` / `descricao` — texto do modal
- `stack` — array de tecnologias
- `cta` — botão principal (label, url, icone FontAwesome)
- `media.video` / `media.capa` / `media.prints` — caminhos relativos à pasta
- `media.demo` — `true` mostra placeholders coloridos, `false` carrega arquivos reais
