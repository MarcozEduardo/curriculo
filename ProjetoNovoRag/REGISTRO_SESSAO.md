# Registro da Sessao — Motor RAG

## O que estamos fazendo
Construir um chat RAG funcional para o curriculo do Marcos.
O chat usa um motor de 3 estagios:
1. **MakeBlock** — segmenta a frase em blocos (principal + soma)
2. **FuzzyFuncionario** — corrige palavras por similaridade (letras na ordem + tamanho)
3. **FuzzyBoss** — deduz intencao por compatibilidade de tipos (verbo -> atributo)

## Area de operacao
APENAS: `OfficeBoss/curriculo/ProjetoNovoRag/`

## Decisoes importantes (ordem cronologica)

### 1. Fuzzy NAO adivinha typos
- Compara letras-na-ordem + proporcao de tamanho
- Token maior que candidata = score 0 (overwrite)
- Token <=3 letras = exige 100% cobertura (fix aplicado)
- Sem regex, sem tabela de typos hardcoded

### 2. Posse e logica REAL, nao display
- `pertence_ao_marcos` controla matching em cascata
- "link do LinkedIn do Marcos" = entrega (link->LinkedIn->Marcos)
- "link do Marcos" sozinho = NAO entrega (ambiguo)

### 3. Historia pertence ao OBJETO, nao ao Marcos
- `historia.pertence_ao_marcos = false`
- A historia do LinkedIn e do LinkedIn

### 4. Heranca de verbo em blocos soma
- Soma so herda verbo do principal se MESMA orbita/categoria
- "manda o linkedin e o fuga de bobby" -> fuga e projeto, NAO herda "manda"

### 5. "como" ambiguo resolvido por contexto
- Palavras passadas (foi, surgiu, comecou) -> historia
- Palavras presentes (funciona, faz, serve) -> explicacao
- Sem contexto -> default explicacao

### 6. Motor 100% DINAMICO (MSG 44+)
- Motor le RulesWords + intencoes do objeto. Zero hardcoded.
- Rejeitado motor v1 que tinha verbos duplicados dentro do codigo.
- chat.js carrega lexico + ficha via fetch e chama MotorRAG.processar()

### 7. acionado_por com sets (MSG 55-56)
- Formato: `{ "sets": [{ "modo": "all", "sinais": [...] }, ...] }`
- Motor suporta `all`, `any`, `always`, `any_of_sets`
- `any_of_sets`: qualquer set que casar inteiro dispara a intencao

### 8. Limiar fuzzy de verbos = 0.80 (MSG 59)
- Falsos positivos "assim"->"passa" (0.60) e "que"->"quer" (0.75) eliminados
- "sota"->"solta" (0.80) mantido no limiar
- Limiar de objetos continua 0.60

### 9. Protecao de marcadores compostos no MakeBlock (MSG 64)
- MakeBlock le marcadores do Interrogativos.json e protege posicoes
- "o que e o linkedin" NAO e mais cortado no "e" (somador)
- "o linkedin e o github" continua cortando no segundo "e" (nao protegido)
- 100% dinamico: sem excecoes hardcoded por palavra

### 10. Coringas adiados
- Serao implementados depois do LinkedIn funcionar end-to-end

## Bugs do linkedin.json (status)
| # | Bug | Status |
|---|-----|--------|
| 1 | dono: "historia" -> "linkedin" | CORRIGIDO |
| 2 | historia.pertence_ao_marcos: true -> false | CORRIGIDO |
| 3 | "como" ambiguidade no Boss | CORRIGIDO |
| 4 | acionado_por formato (sets) | CORRIGIDO |
| 5 | depende_de vs depende | ADIADO |
| 6 | requer_estado/on_estado_fail | ADIADO |
| 7 | resposta_inline | CORRIGIDO (motor suporta) |
| 8 | verbo_desejo na intencao errada | CORRIGIDO (MSG 60) |
| 9 | verbo_comunicacao nao escutado | CORRIGIDO (MSG 60) |

## Mudancas nesta sessao (MSG 54-66)

### linkedin.json
- `acao_entrega_link.modo`: "all" -> "any_of_sets" com 3 sets: verbo_entrega, interrogativo_local, verbo_desejo
- `acao_contar_historia.acionado_por`: adicionado set com verbo_comunicacao
- `acao_explicar_historia.acionado_por`: removido verbo_desejo (estava errado)

### motor-browser.js (391 -> 417 linhas)
- MakeBlock: protecao dinamica de marcadores compostos do Interrogativos.json
- classificarToken: limiar fuzzy verbos 0.5 -> 0.8

### test-dinamico.js
- Trocado `processar()` local por `MotorRAG.processar()` real
- Ajustado campos `resultados`->`decisoes`, `attr`->`atributo`

## Resultados de teste
- **runner.js**: 21/21 asserts passando
- **test-dinamico.js**: 20/20 frases corretas (verificacao manual)

## Arquivos criados/modificados nesta sessao
```
Orbitas/Contato/Objetos/LinkedIn/linkedin.json  (modificado)
motor-browser.js                                 (modificado)
engine/_test/test-dinamico.js                    (modificado)
```

## Formato do bobcode (aprendido na marra)
```json
{"tool": "run_command", "args": {"command": "...", "confirmed": true}}
{"tool": "read_file", "args": {"path": "..."}}
{"tool": "write_file", "args": {"path": "...", "content": "..."}}
{"tool": "edit_file", "args": {"path": "...", "old_string": "...", "new_string": "..."}}
{"tool": "read_lines", "args": {"path": "...", "start": N, "end": N}}
{"tool": "list_files", "args": {"path": "..."}}
{"tool": "celebrate", "args": {"count": 2000}}
```
- O campo e `args`, NAO `params`
- `confirmed: true` necessario pra run_command
- edit_file falha com caracteres especiais unicode no old_string
- edit_file falha se whitespace (tabs vs espacos) nao casar exato
- write_file mais confiavel pra reescrita total
- read_lines max 15 linhas

## Proximos passos
1. Integrar chat.js com o motor (testar no browser)
2. Criar mais objetos (GitHub, Email, WhatsApp)
3. Resolver bugs #5-#6 do linkedin.json (depende_de, requer_estado)
4. Implementar coringas
5. Implementar rastro de orbita e camada de profundidade
6. Alinhar limiar fuzzy do FuzzyFuncionario (0.4) com o motor (0.8)
