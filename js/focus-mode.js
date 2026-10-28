/**
 * Modo Leitura Focada — Overlay Holograma
 * Carrega sections/<nome>.html dentro do overlay ao clicar nas pills.
 */
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('focusOverlay');
  const focusBody = document.getElementById('focusBody');
  const focusTitle = document.getElementById('focusTitle');
  const focusSubtitle = document.getElementById('focusSubtitle');
  const closeBtn = document.getElementById('focusClose');
  const pills = document.querySelectorAll('.fn-pill, .fn-pill-compact');

  if (!overlay || !pills.length) return;

  const labels = {
    perfil: 'Perfil',
    formacao: 'Formação',
    skills: 'Skills',
    projetos: 'Projetos',
    experiencias: 'Experiências'
  };

  function openSection(slug) {
    const label = labels[slug] || slug;
    focusSubtitle.textContent = label;
    focusBody.innerHTML =
      '<div class="focus-loading"><i class="fa-solid fa-circle-notch fa-spin"></i><p>Carregando leitura...</p></div>';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    fetch('sections/' + slug + '.html')
      .then((r) => {
        if (!r.ok) throw new Error('Falha ao carregar ' + slug);
        return r.text();
      })
      .then((html) => {
        focusBody.innerHTML = html;
        initSkillSidebar();
      })
      .catch((err) => {
        console.error(err);
        focusBody.innerHTML =
          '<div class="focus-loading"><i class="fa-solid fa-triangle-exclamation"></i><p>Não foi possível carregar esta seção.</p></div>';
      });
  }

  function closeSection() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  // Ativa a sidebar de skills quando a seção skills.html é carregada
  function initSkillSidebar() {
    const tabs = focusBody.querySelectorAll('.skill-tab');
    const panels = focusBody.querySelectorAll('.skill-panel');
    if (!tabs.length || !panels.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-skill');
        tabs.forEach((t) => t.classList.remove('active'));
        panels.forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = focusBody.querySelector('.skill-panel[data-panel="' + target + '"]');
        if (panel) panel.classList.add('active');
      });
    });
  }

  pills.forEach((btn) => {
    btn.addEventListener('click', () => {
      const slug = btn.getAttribute('data-section');
      if (slug) openSection(slug);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeSection);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSection();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeSection();
  });
});