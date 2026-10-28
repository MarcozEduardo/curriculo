# 💡 BACKLOG VIVO & IDEIAS PENDENTES

> Documento para guiar as próximas fases de refinamento do currículo do Marcão.

---

## 🔴 1. Repensar o Card de PCD / Neurodivergente (Prioridade Alta)
- **O que o Marcão disse:** *"não tô gostando do PCD escancarado como ficou. a ideia não era essa"*
- **O problema atual:** O card está com muito destaque visual na coluna esquerda (`.pcd-card`), parecendo um aviso médico gigante.
- **Ideias de Solução para a Próxima IA:**
  - Integrar o TEA Nível 1 discretamente dentro do texto do Resumo Profissional ou como uma "Badge de Habilidade / Diferencial Analítico".
  - Criar um botão discreto tipo "ℹ️ Enquadramento PCD & Laudo" que abre um pop-up elegante apenas se o recrutador tiver interesse.
  - Manter o conhecimento ativo no RAG do Bobby para responder quando perguntado, mas reduzir o peso visual no layout físico.

---

## 🟡 2. Janela / Iframe Interativo de Detalhes dos Projetos
- **Conceito:** Ao clicar em um projeto (ex: *"A Fuga de Bobby"* ou *"DirectSend"*), em vez de apenas link externo, abrir um modal/iframe interno estilo "Tablet" com:
  - Vídeo curto ou print em alta resolução da gameplay/interface.
  - Arquitetura técnica (como foi feito, desafios de colisão, WebRTC).
  - Botão de "Jogar / Testar na Vercel".
  - Abas para alternar entre os outros projetos sem precisar fechar a janela.

---

## 🟡 3. Limpeza de Descritores no GitHub via API
- Atualizar via script a descrição dos repositórios `DirectSend` e `MarcosTesteChat` na conta do GitHub para remover termos que mencionem a ferramenta pessoal proprietária.

---

## 🟢 4. Expansão de Jogos e Deploys Futuros
- Subir o deploy público do **Dama Orbital** (Dama Multiplayer via WebRTC/Firebase) e atualizar o link correspondente no `data/curriculum.json` e `index.html`.
- Concluir o editor visual do **Quadra 21 – Barra Pesada** e do **O Estagiário** para adicionar prints interativos no portfólio.

---

## 🟢 5. Refinamento do Motor de PDF Nativo (Canvas-to-Vector)
- Estudar migração do `html2canvas` para geração vetorial pura em `jsPDF` caso algum cliente/recrutador exija texto 100% selecionável com fontes embutidas (hoje o `html2pdf` já preserva links clicáveis com `enableLinks: true`).
