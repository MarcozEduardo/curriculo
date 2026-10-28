# ARQUITETURA DO RAG SEMÂNTICO (O Conceito)

Este documento salva o raciocínio exato desenhado pelo Marcos na madrugada do dia 19/10. Se o contexto da IA resetar, ela deve ler este arquivo para saber exatamente como o motor deve ser construído.

## 1. As 3 Camadas Globais (Sem Redundância)

### Camada 1: Dicionário Global de Sinônimos
Arquivo único: `Global/Dicionario.json`
Aqui ficam as equivalências de palavras. Nenhum objeto ou órbita deve ter listas de sinônimos embutidas.
```json
{
  "whatsapp": "telefone",
  "zap": "telefone",
  "wpp": "telefone",
  "celular": "telefone",
  "git": "github",
  "linkedim": "linkedin"
}
```

### Camada 2: Verbos e Conectores Globais
Arquivo: `Global/Gramatica.json`
Os verbos não pertencem a uma órbita. Eles pertencem à ação.
```json
{
  "verbos_entrega": ["manda", "passa", "envia", "solta", "cola", "joga"],
  "verbos_explicacao": ["conta", "explica", "fala", "detalha", "saber"],
  "verbos_desejo": ["quero", "preciso", "gostaria", "poderia"],
  "conectores": {
    "artigo_m": ["o", "os"],
    "artigo_f": ["a", "as"],
    "posse_m": ["do", "dele"],
    "posse_f": ["da", "dela"],
    "interacao": ["com", "pro", "pra"]
  }
}
```

### Camada 3: Bibliotecas de Super-Objetos (As Gavetas Centralizadas)
Pasta: `Global/Bibliotecas/`
Objetos que são ricos demais e servem para o RAG inteiro. As respostas das órbitas NUNCA devem escrever o link ou o telefone na mão. Elas chamam a VAR.

Exemplo `Telefone.json`:
```json
{
  "nome": "telefone",
  "tamanho": 8,
  "genero": "m",
  "pertence_a": ["marcos"],
  "variavel": "(61) 98222-7804"
}
```

Exemplo `Link.json`:
```json
{
  "nome": "link",
  "tamanho": 4,
  "genero": "m",
  "variaveis": {
    "github": "github.com/MarcozEduardo",
    "linkedin": "linkedin.com/in/sir-marcos-eduardo",
    "fuga_bobby": "game-a-fuga-de-bobby.vercel.app"
  }
}
```

## 2. O Motor (O Parser de Gramática)

O motor não busca frases prontas. Ele classifica as peças da frase do usuário e cruza com as regras.

Regra da Entrega:
Se a frase tiver `[Verbo de Entrega]` + `[Artigo Definido]` + `[Objeto]` -> O motor entrega a VAR do objeto.

Regra da Explicação (Saída Estratégica):
Se a frase tiver `[Verbo de Explicação]` + `[Conector de Posse]` + `[Objeto/Sujeito]` -> O motor não entrega o dado. Ele esfria a bolha e chama a outra órbita.

Regra da Dúvida:
Se a frase tiver `[Verbo de Desejo]` + `[Saber]` mas NENHUM objeto -> O motor gera dúvida.

## 3. A Regra do Fuzzy Operário e do Fuzzy Chefe

Fuzzy Operário (Palavra): Ele usa distância de edição (tamanho e letras). `Linc` (4 letras) é muito diferente de `Linkedin` (8 letras). O Fuzzy Operário entende que `Linc` é um erro de `Link` (4 letras), não de `Linkedin`. `Likdin` (6 letras) está mais perto de `Linkedin` (8 letras) e tem as mesmas letras na ordem certa. Ele corrige pra `Linkedin`.

Fuzzy Chefe (Frase): Depois que as palavras são corrigidas pelo Operário, o Chefe lê a frase e aplica as regras do motor (Verbo + Conector + Objeto).

---
FIM DO DOCUMENTO.
