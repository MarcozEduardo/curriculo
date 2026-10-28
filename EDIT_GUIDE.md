# 🛠️ GUIA DE EDIÇÕES E RECEITAS RÁPIDAS

> Leia este guia para saber exatamente **como**, **onde** e **o que** editar no projeto de forma segura, sem quebrar o RAG ou o layout do PDF.

---

## 📝 Receita 1: Adicionar, Remover ou Mudar um Projeto no Currículo

Para atualizar o portfólio físico e o RAG simultaneamente, você deve mexer em **3 arquivos**:

### Passo 1: Atualizar o dado bruto em `data/curriculum.json`
- Abra `data/curriculum.json`.
- Localize a chave correspondente (`games`, `ferramentas` ou `academico`).
- Adicione ou edite o objeto do projeto seguindo o schema:
  ```json
  {
    "nome": "Nome do Projeto",
    "subtitulo": "Subtítulo Curto",
    "stack": "TypeScript · Vercel",
    "status": "jogavel",
    "status_label": "Jogável",
    "link": "https://link-do-deploy.vercel.app",
    "desc": "Descrição curta de duas linhas."
  }
  ```

### Passo 2: Atualizar o HTML visível em `index.html`
- Abra `index.html`.
- Procure por `id="sec-projetos"`.
- Duplique ou edite o bloco `.project-card` correspondente.
- Certifique-se de que as classes de status estejam corretas (`status-jogavel`, `status-em-refino`, `status-em-testes`, `status-concluido`).

### Passo 3: Atualizar o RAG em `data/knowledge_base.json`
- Abra `data/knowledge_base.json`.
- Adicione ou edite o chunk na chave `chunks`.
- Certifique-se de adicionar **palavras-chave (keywords)** em minúsculo e sem acento no array `keywords`. O motor do RAG usa essa lista para fazer o match fuzzy!

---

## 🎨 Receita 2: Ajustar a Cor ou Elemento Visual de um Card

- **Para mudar o visual global, contraste ou sombras:**
  - Abra `css/layout.css`.
  - Altere as variáveis no topo em `:root`.
  - Modifique as propriedades da classe `.card`.
- **Para mudar o visual do topo estilo App:**
  - Abra `css/header.css`.
  - Para aumentar ou diminuir a foto do Marcão, mexa na classe `.photo-circle` (largura e altura) e no seletor `.photo-circle img` (propriedade `transform: scale(...)` para ajustar o zoom).
- **Para mudar a Timeline ou Skills:**
  - Abra `css/experience.css`.
  - Modifique as classes `.exp-item`, `.exp-dot` ou `.pill`.

---

## 🤖 Receita 3: Ensinar uma nova Resposta Temática ou de RH ao Bobby

- **Se for uma pergunta comum de Recrutador (pretensão, início, etc.):**
  - Abra `rag/responses/recruiter_faq.json`.
  - Adicione um objeto dentro do array `intents`:
    ```json
    {
      "id": "nome_da_intencao",
      "patterns": ["pergunta 1", "como funciona", "voce tem interesse"],
      "variations": [
        "Resposta rica em **markdown** e com variação 1.",
        "Resposta com variação 2."
      ]
    }
    ```
- **Se for uma pergunta geral sobre o Marcos:**
  - Abra `rag/responses/about_marcos.json` e adicione uma nova frase no array `variations`.

---

## 🤬 Receita 4: Bloquear um novo Palavrão ou Ofensa no Chat

- Abra `rag/dictionary/profanity_list.json`.
- Adicione o termo em minúsculo, sem acentos, entre aspas, separado por vírgula no fim do array.
- **Como testar:** Abra o chat no navegador e digite o termo. O Bobby deve retornar uma resposta de moderação contida em `rag/responses/profanity_response.json`.

---

## 📄 Receita 5: Ajustar Quebra de Página ou Margens no PDF A4

- Se o PDF estiver gerando páginas em branco extras ou cortando cards no meio:
  - Abra `css/print-a4.css`.
  - Modifique as margens na classe `.capture-mode .sheet` (ex: `padding: 6mm 10mm 10mm 10mm !important`).
  - Certifique-se de que os cartões que não podem quebrar possuam as propriedades `page-break-inside: avoid !important; break-inside: avoid !important;` cadastradas.
