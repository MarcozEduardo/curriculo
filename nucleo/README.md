# Nucleo Nexus

Teia semantica de nos. Renderiza orbitas + facetas + atributos em canvas 2D.

## Arquivos
- nucleo.html: shell + canvas 2D + NucleoChip class
- nucleo.css: badge trigger (header) + modal fullscreen
- nucleo-bridge.js: parent <-> iframe via postMessage
- nucleo-data.js: monta snapshot do ranker real

## Fluxo
1. index.html carrega os 4 arquivos
2. Clique no badge #nucleoOpenBtn abre modal
3. Bridge unhide overlay do iframe + injeta CSS (ocultar chip/fechar internos)
4. Bridge envia postMessage snapshot no load + interval 4s + hook answer()
5. Iframe renderiza com spring + colisao
6. Botao demo ou inspector envia postMessage ask
7. Bridge FECHA modal + chama BobbyChat.ask()

## Bugs corrigidos
- Orbita ativa nao retraia (auto-open no setSnapshot) -> userClosed Set
- Implosao chacoalhava demais -> damping 0.42 (mata velocidade rapido)
- Colisao muito agressiva -> minD 46, push 0.28, 1 iteracao
- Jiggle perdido -> oscilacao +-3px no target de cada no
- Botao "bora de ex01" -> "me fala sobre X"
- Bridge nao fechava modal no ask -> fix
- Duplo clique = isolar orbita (novo)

## TODO (proxima IA)
- Cascade animation: chip -> orbita -> facet -> chip (sequencial, com timings)
- Memory chip "RAM sessao" com barras de ocupacao
- Pulsing lines entre orbitas visitadas (heartbeat de memoria)
- Cache de radialGradient (performance mobile)
- Auto-zoom-out mobile
- Nada entre chip e orbitas (limpar barramentos PCB?)

## Estrutura NucleoChip
- constructor: inicializa state, starfield, bind events
- setSnapshot(snap): chamado pelo bridge, aplica estado
- _desenharPixelChip: chip pixel art central
- _loop: renderFrame 30fps com LOD
- _encontrarAlvo: hit test por (x,y)
- _tratarClique: dispatcher orbita/objeto/atributo/chip
- _isolarOrbita: duplo clique especial
- _updateInspector: painel inferior-esquerdo