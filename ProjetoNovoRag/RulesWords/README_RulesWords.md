# RulesWords — Léxico Global do RAG Semântico

> **Padrão universal da pasta.** Todo arquivo `.json` aqui segue este formato.
> Última atualização: 19/10/2026.

## O que é esta pasta

`RulesWords/` é o **léxico declarativo** do RAG. Não tem lógica, não tem resposta, não tem objeto — só **dados** sobre as palavras que o motor precisa reconhecer para classificar uma frase do usuário.

É a **materialização da Camada 2 do `ARQUITETURA_RAG.md`** (Verbos + Conectores Globais), mas com **evolução de granularidade**: em vez de um arquivo monolítico `Global/Gramatica.json`, cada categoria de palavra mora no seu próprio arquivo. Por quê:

- **Editabilidade:** mexer em Interrogativos não arrisca quebrar Verbos.
- **Leitura do motor:** o motor carrega só o que precisa, quando precisa.
- **Blame/diff:** mudanças por categoria ficam rastreáveis.

O documento descreve o **conceito** (Camada 2 = léxico de verbos e conectores). O disco **materializa** em arquivos separados. Esta é a única divergência intencional entre `ARQUITETURA_RAG.md` e o disco — e ela existe a favor da manutenção.

## Arquivos da pasta

| Arquivo | Contém | Sinais que emite | Estado |
|---|---|---|---|
| `Verbos.json` | Radicais + conjugações por ação | `verbo_entrega`, `verbo_desejo`, `verbo_comunicacao`, `verbo_busca` | 🟡 piloto (falta `verbo_explicacao`) |
| `Interrogativos.json` | Subtipos de pergunta | `interrogativo_definicao`, `interrogativo_explicacao`, `interrogativo_historia`, `interrogativo_local`, `interrogativo_pessoa`, `interrogativo_quantidade` | 🟢 piloto 1.0 |
| `Conectores.json` | Preposições, posse, interação | `conector_posse_m`, `conector_posse_f`, `conector_interacao`, `preposicao_geral` | 🟡 piloto (falta `conector_posse` genérico) |
| `Artigos.json` | Artigos definidos | `artigo_definido_m`, `artigo_definido_f` | 🟡 piloto (falta `artigo_definido` genérico) |
| `Somadores.json` | Conjunções aditivas | `somador_adicao_direta`, `somador_adicao_enfatica`, `somador_continuacao` | 🟢 piloto |
| `Pronomes.json` | Pronomes pessoais e possessivos | `pronome_primeira_pessoa`, `pronome_terceira_pessoa_m`, `pronome_terceira_pessoa_f`, `pronome_possessivo_contextual` | 🟢 piloto |

**Nomenclatura dos sinais:** substantivo no singular, sem gênero na chave. Gênero vira dado separado ou sufixo explícito (`_m`/`_f`) **só quando o motor precisar distinguir**. Se a intenção do objeto aceita os dois gêneros, ela lista ambos.

## Padrão universal de arquivo

Todo arquivo `.json` aqui deve ter:

```json
{
  "_meta": {
    "padrao": "Orbitas · Léxico Semântico",
    "versao_padrao": "1.0",
    "versao_arquivo": "X.Y[-piloto]",
    "tipo": "lexico-semantico",
    "categoria": "<nome-da-categoria-no-plural>",
    "descricao": "Uma frase explicando o que este arquivo contém.",
    "fonte_conceitual": "Referência ao ARQUITETURA_RAG.md ou decisão do Marcos.",
    "convencoes_gerais": "Ver README_RulesWords.md.",
    "como_usar": "Como o motor / objetos consomem este arquivo.",
    "arquivos_relacionados": ["..."]
  },
  "<categoria>": {
    "<sinal_especifico>": { ... }
  },
  "regras_compostas": { ... }
}
```

- `_meta` é **obrigatório**.
- `<categoria>` no payload é o plural do nome do arquivo (`interrogativos`, `verbos`, `conectores`).
- `regras_compostas` é **opcional** — só quando há conflito entre sinais do mesmo arquivo que o motor precisa desempatar.

## Convenções gerais

1. **Case-insensitive.** Marcadores em minúsculas; o motor normaliza a frase do usuário antes de casar.
2. **Acento opcional.** `"o que é"` e `"o que e"` são equivalentes — listar ambos é aceitável; o motor pode normalizar.
3. **Prioridade 0-10.** Maior vence no desempate entre sinais da mesma categoria. Empate: ordem de declaração no JSON vence.
4. **Sem lógica.** Este arquivo lista marcadores. Não tem regex, não tem função, não tem 'se então'. Regras complexas (verbo X + objeto Y) moram na **intenção do objeto**.
5. **Sem resposta.** Nenhum texto de resposta mora aqui. Só marcadores.
6. **Sem lista de sinônimos por órbita.** Sinônimos genéricos ficam em `Global/Dicionario.json` (a criar). Este léxico é sobre **categorias gramaticais**, não sobre vocabulário de um objeto específico.
7. **Auto-contido.** Cada arquivo faz sentido sozinho. O `_meta` explica o propósito; o payload entrega os dados.
8. **Sem typo hardcoded.** Erros de digitação são responsabilidade do Fuzzy Operário (distância de edição proporcional ao tamanho). Nunca adicionar `"Likdin"` aqui — o Operário corrige.

## Como o motor consome

Fluxo canônico (descrito em `ARQUITETURA_RAG.md` seções 2 e 3):

```
Frase do usuário
  → Tokenizer (separa palavras)
  → Fuzzy Operário (corrige typos palavra a palavra)
  → Casamento em RulesWords (cada token → 0+ sinais)
  → Fuzzy Chefe (monta Bloco Semântico com verbo + objeto + posse)
  → Objeto (LinkedIn, Contato, etc) decide qual intenção dispara
  → Resposta (texto mora em caminho_resposta do objeto)
```

O motor **não** olha RulesWords procurando 'a resposta'. Ele olha procurando **sinais**. Os sinais compõem o Bloco, o Bloco bate nas intenções do objeto, o objeto aponta pro texto.

## Relação com objetos (LinkedIn, etc)

Objetos referenciam sinais daqui nas suas `intencoes[].acionado_por`. Exemplo (LinkedIn JSON):

```json
"acao_entrega_link": {
  "acionado_por": ["verbo_entrega"],
  "modificadores_opcionais": ["artigo_definido"]
}
```

Ou seja: **o objeto não sabe o que é 'manda'**. Ele sabe que existe um sinal chamado `verbo_entrega`, e que este arquivo (`Verbos.json`) emite esse sinal quando a frase contém `manda`, `passa`, `envia`, etc.

Se um dia `Verbos.json` mudar quais palavras emitem `verbo_entrega`, muda **aqui**, não no objeto. **Uma fonte de verdade.**

## Como adicionar categoria nova

1. Crie `RulesWords/<Categoria>.json` seguindo o padrão universal acima.
2. Nomeie os sinais com prefixo da categoria (`somador_*`, `pronome_*`, `conector_*`).
3. Se conflitar com sinais de outra categoria, registre em `regras_compostas` do próprio arquivo (ou peça ao Marcos para criar `RulesWords/_conflitos.json` — ainda não existe).
4. Atualize a tabela 'Arquivos da pasta' acima.
5. Se a categoria nova for referenciada por algum objeto, atualize o objeto também.

## O que NÃO mora aqui

- **Respostas** → `Orbitas/**/Responses/*.json` (caminho apontado pelo objeto).
- **Texto de história/definição** → `Orbitas/**/Objetos/*/History_*/`, `Definition.json`.
- **Sinônimos genéricos** (zap → telefone) → `Global/Dicionario.json` (a criar).
- **Bibliotecas de super-objetos** (Telefone, Link) → `Global/Bibliotecas/*.json` (a criar).
- **Lógica de intenção** (verbo X + objeto Y = ação Z) → no objeto, em `intencoes[]`.
- **Configuração de motor** (thresholds, pesos) → no motor, não aqui.

## Pendências conhecidas

- `Verbos.json` **não tem** `verbo_explicacao` (conta, explica, detalha, saber). Sem isso, `acao_contar_historia` e `acao_explicar_historia` do LinkedIn não disparam. **Bloqueia o piloto.**
- `Conectores.json` e `Artigos.json` estão quebrados em `_m`/`_f` sem fornecer o sinal genérico (`conector_posse`, `artigo_definido`) que o LinkedIn JSON pede. Motor precisa juntar, ou arquivos precisam emitir ambos.
- `Global/` não existe ainda — `buscar_em` do link no LinkedIn JSON aponta pra pasta inexistente.
- `_conflitos.json` (registro central de conflitos entre categorias) não existe. Hoje cada arquivo auto-documenta seus conflitos em `regras_compostas`.

---

**Padrão mantido por:** Marcos (comandante) + copiloto IA.
**Última revisão de padrão:** 19/10/2026.
