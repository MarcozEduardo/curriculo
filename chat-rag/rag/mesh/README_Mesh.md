# 🕸️ Camada MESH — órbitas, satélites e facetas

Esta pasta é o cérebro de **roteamento semântico** do Bobby.

---

## Arquivos

### `orbits.json`
Define as **órbitas** (grandes temas) e as respostas de nível de órbita.

```jsonc
{
  "id": "projetos",
  "label": "Projetos e Portfólio",
  "source": "Portfólio · Projetos",   // badge mostrado no chat
  "priority": 8,                       // desempate suave no roteamento
  "subjects": ["projeto", "portfolio", "jogo", ...],   // usado pelo gerador
  "keywords": ["projeto", "deploy", "github", ...],    // bônus direto no router
  "facet_aliases": { "quantidade": "tempo_total" },    // faceta X responde como Y
  "facets": { "default": [...], "tecnologias": [...] } // variações de resposta
}
```

- **Deps:** nenhuma (JSON puro).
- **UsedBy:** `engine/orbit_router.js`, `engine/ranker.js`, `tools/build_question_bank.mjs`.

### `facets.json`
Define **o que** está sendo perguntado (tecnologias, desafio, duração, status, link, pretensão, PCD, etc.) e os **superlativos** (maior, menor, mais recente, mais antigo, mais rápido, mais demorado).

Cada faceta tem:
- `triggers`: frases canônicas (match exato e fuzzy)
- `regex`: padrões tolerantes (`tecnolog\w*`, `dificuld\w*`…)
- `weight`: peso relativo
- `home_orbit` (opcional): órbita natural da faceta — corrige o roteamento quando a pergunta cai no lugar errado

- **UsedBy:** `engine/facet_detector.js`.

### `question_templates.json`
Frames de pergunta por faceta (`"quais tecnologias de {s}"`). O gerador cruza
**frames × sujeitos** (subjects da órbita + nomes/aliases das entidades).

### Facetas especiais

- `study_case` (home: projetos): a história por trás de um projeto, com os fatos que o dono contou (ex.: SOCRAM, a reconstrução da Dama Orbital por worklogs, os 40 minutos da Viagem com a engine pronta).
- `processo` (home: projetos): o processo de trabalho, debugging, IA em surto (modo metralhadora), pagar sapo, psicólogo de IA, LAR e o motivo de projetos em aberto (parar para estudar).

### `topic_choices.json`
Respostas curtas às opções que Bobby oferece, como **"condições"**, **"stack"** e
**"projetos"**. A escolha explícita define órbita e faceta antes da memória
contextual. Assim, selecionar "condições" depois de falar de DirectSend troca para
recrutamento e limpa o projeto ativo, em vez de continuar sobre DirectSend.

### `questions/*.json` — **GERADO, não editar**
Um arquivo por órbita, com 200–420 variações de pergunta já tokenizadas:

```json
{ "orbit": "projetos", "format": ["facet","entity","tokens"],
  "entries": [["tecnologias","proj_dama_orbital","quais tecnologias dama orbital"]] }
```

O total muda conforme os dados e templates. Confira `questions/manifest.json`; não trate a quantidade gerada como quantidade de respostas factuais.

---

## Como regenerar

```bash
node tools/build_question_bank.mjs
```

O gerador é determinístico (PRNG com semente fixa): mesma entrada → mesma saída.

---

## Como o router usa isso

1. Monta um **índice invertido** token → entradas.
2. Corrige tokens desconhecidos por fuzzy contra o vocabulário.
3. Pontua cada órbita pelo **melhor casamento** + densidade de acertos (IDF).
4. Soma bônus: keywords da órbita, prioridade, **órbita ativa** (contexto pegajoso) e órbita da entidade citada.
5. Marca `ambiguous` quando as duas primeiras órbitas ficam empatadas → o bot pergunta qual delas.
6. Uma escolha como `condições` é resolvida por `topic_choices.json` antes do contexto anterior. A entidade ativa é limpa na troca de assunto.
7. Para responder `mais recente`, `maior` ou `mais demorado`, exige dados comparáveis. Se os registros forem incompletos, o bot explica a limitação em vez de ranquear um item por falta de informação.


---

## 🔒 Política de remuneração (OBRIGATÓRIA)

**Nenhum arquivo deste bundle pode conter valor, faixa ou moeda de salário.**

A faceta `pretensao` (órbita `recrutamento`) responde sempre de forma institucional:
*a combinar, compatível com a faixa praticada para a posição*, encaminhando o
alinhamento para contato direto.

Há ainda uma trava de segurança no motor — `RagRanker.enforceSalaryPolicy()` —
aplicada a **toda** saída de `answer()`. Se algum conteúdo trouxer valor monetário,
a resposta é substituída pelo texto institucional e um aviso vai ao console.

A trava ignora números legítimos: número de lei (12.764/2012), telefone, anos de
experiência, quantidade de modelos testados e contagem de ferramentas.

Para auditar:

```bash
grep -rniE 'r\$|reais|sal[áa]rio de' public/chat-rag/data public/chat-rag/rag --include=*.json
```

---

## 🧭 Órbitas atuais (13)

`identidade_visitante` · `sobre_marcos` · `historia_pessoal` · `projetos` · `skills` ·
`experiencia` · `formacao` · `pcd` · `contato` · `recrutamento` · `transparencia` ·
`meta_ia` · `smalltalk`

A órbita **`transparencia`** é intencional: ela responde abertamente o que o
candidato **ainda não domina** (certificações, cloud corporativa, QA automatizado,
Git avançado, inglês conversacional), com o respectivo plano de ramp-up.
