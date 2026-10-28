# 📖 Sections — Modo Leitura Focada

Pasta dos conteúdos carregados pelo **Overlay Holograma** do Modo Leitura Focada. Cada arquivo é injetado no `#focusBody` via `fetch()` quando o usuário clica numa pill da nav.

---

## 📄 Arquivos

| Arquivo | Acionado por | Conteúdo |
|---|---|---|
| `perfil.html` | pill `data-section="perfil"` | Bio profissional narrativa em 1ª pessoa |
| `formacao.html` | pill `data-section="formacao"` | Graduação Unyleya + CS50 Harvard |
| `skills.html` | pill `data-section="skills"` | Stack técnica em IA, dev, suporte, QA |
| `projetos.html` | pill `data-section="projetos"` | Trilogia de games, ferramentas, acadêmico |
| `experiencias.html` | pill `data-section="experiencias"` | Timeline profissional completa |

---

## 🔧 Dependências (`deps`)

- **Quem usa:** `js/focus-mode.js` (fetch via slug do `data-section`)
- **Estilo aplicado:** `css/focus-mode.css` (classes `.focus-doc`, `.focus-lead`, `blockquote`, `hr`)
- **Pills que disparam:** `index.html` → `.fn-pill` (header expandida) e `.fn-pill-compact` (header compacta)

---

## ✏️ Como editar uma seção

1. Abrir o arquivo `sections/<nome>.html`
2. Envolver todo o conteúdo em `<article class="focus-doc">...</article>`
3. **NÃO** incluir `<html>`, `<head>`, `<body>` — é um fragmento, não uma página completa
4. Usar as tags semânticas que o CSS já estiliza:
   - `<h1>` — título principal da seção (só 1)
   - `<p class="focus-lead">` — parágrafo de abertura destacado
   - `<h2>` — subtítulos (linha laranja embaixo)
   - `<p>` — parágrafo comum
   - `<ul><li>` — listas
   - `<blockquote>` — citação com barra laranja
   - `<hr>` — divisor
   - `<strong>` — destaque em laranja
   - `<em>` — itálico discreto

---

## 🚫 Regras

1. **Nunca incluir CSS ou JS inline** — o estilo vem de `focus-mode.css`
2. **Nunca incluir `<a>` com classe própria** — o CSS já estiliza links dentro de `.focus-doc`
3. **Nunca usar PCD/TEA/laudo** nas seções públicas — esse conteúdo fica só na nota legal discreta do rodapé do PDF
4. **Sempre escrever em 1ª pessoa ou voz ativa** — o Modo Leitura é pessoal, não corporativo
5. **Nunca inventar dado** — só reorganizar o que existe em `data/curriculum.json` ou no que o Marcão confirmou

---

## 🎯 Pendências conhecidas

- `perfil.html` — **completo** (bio + 10 anos + transição + IA + blockquote + contatos)
- `formacao.html` — placeholder (conteúdo real pendente)
- `skills.html` — placeholder (conteúdo real pendente)
- `projetos.html` — placeholder (conteúdo real pendente)
- `experiencias.html` — placeholder (conteúdo real pendente)
