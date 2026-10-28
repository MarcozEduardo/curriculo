# Estrutura de Dados - Currículo & RAG

Esta pasta centraliza os dados canônicos do currículo e a base de conhecimento semântica do assistente Bobby.

## 📄 Arquivos

- `curriculum.json` -> Fonte de dados estruturada do currículo (perfil, resumo, projetos categorizados por Games/Ferramentas/Acadêmico, habilidades, formação e experiências).
- `knowledge_base.json` -> Chunks semânticos indexados para o motor RAG client-side. Cada chunk contém `id`, `category`, `title`, `keywords`, `content` e `source` para citação de fontes.
