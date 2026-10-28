/**
 * UI & Interações do Currículo
 */

function showToast(message, icon = 'fa-circle-check') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function copyToClipboard(text, successMsg, icon = 'fa-circle-check') {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => showToast(successMsg, icon));
  } else {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast(successMsg, icon);
  }
}

// Botão PDF — baixa direto (monta em container oculto)
function downloadCurriculumPDF() {
  if (window.PdfPreview && window.PdfPreview.download) {
    window.PdfPreview.download();
  } else {
    showToast('Gerador de PDF indisponível', 'fa-triangle-exclamation');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // ============ COPIAR CONTATOS ============ 
  const bindCopy = (id, text, msg, icon) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => copyToClipboard(text, msg, icon));
  };

  bindCopy('copyPhone', '(61) 98222-7804', 'Telefone copiado!', 'fa-phone');
  bindCopy('headerPhone', '(61) 98222-7804', 'Telefone copiado!', 'fa-phone');
  bindCopy('copyEmail', 'marcos.eduardo@myyahoo.com', 'Email copiado!', 'fa-envelope');
  bindCopy('copyGithub', 'https://github.com/MarcozEduardo', 'GitHub copiado!', 'fa-github');
  bindCopy('headerGithub', 'https://github.com/MarcozEduardo', 'GitHub copiado!', 'fa-github');
  bindCopy('headerName', 'Marcos Eduardo da Silva dos Reis', 'Nome copiado!', 'fa-user');

  // ============ BOTÃO DOWNLOAD PDF ============ 
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', downloadCurriculumPDF);
  }

  // ============ MODAL LINKEDIN ============ 
  const linkConfirmModal = document.getElementById('linkConfirmModal');
  const linkCancelBtn = document.getElementById('linkCancelBtn');
  const linkOpenBtn = document.getElementById('linkOpenBtn');
  const openLinkedin = document.getElementById('openLinkedin');

  if (openLinkedin && linkConfirmModal) {
    openLinkedin.addEventListener('click', () => linkConfirmModal.classList.add('open'));
  }
  if (linkCancelBtn) {
    linkCancelBtn.addEventListener('click', () => linkConfirmModal.classList.remove('open'));
  }
  if (linkOpenBtn) {
    linkOpenBtn.addEventListener('click', () => {
      linkConfirmModal.classList.remove('open');
      window.open('https://www.linkedin.com/in/sir-marcos-eduardo', '_blank');
    });
  }
  if (linkConfirmModal) {
    linkConfirmModal.addEventListener('click', (e) => {
      if (e.target === linkConfirmModal) linkConfirmModal.classList.remove('open');
    });
  }

  // ============ VOLTAR AO TOPO ============ 
  const backTopBtn = document.getElementById('backTopBtn');
  const stickyTopBtn = document.getElementById('stickyTopBtn');
  if (backTopBtn) backTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  if (stickyTopBtn) stickyTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ============ HEADER DUAL (EXPANDIDO → COMPACTO) ============
  const expandedHeader = document.querySelector('.app-header-expanded');
  const compactHeader = document.getElementById('compactHeader');
  const compactNav = document.getElementById('focusedNavCompact');
  const compactPhoto = document.querySelector('.compact-photo');
  const photoCircle = document.getElementById('photoCircle');

  if (expandedHeader && compactHeader) {
    let triggerY = 200;
    const computeTrigger = () => {
      // Dispara quando o header expandido sumiu de cima
      triggerY = expandedHeader.offsetHeight;
    };
    computeTrigger();
    window.addEventListener('resize', computeTrigger);

    let isShrunk = false;
    const toggleShrink = () => {
      const y = window.scrollY;
      if (!isShrunk && y > triggerY) {
        compactHeader.classList.add('show');
        if (compactNav) compactNav.classList.add('show');
        isShrunk = true;
      } else if (isShrunk && y < 60) {
        compactHeader.classList.remove('show');
        if (compactNav) compactNav.classList.remove('show');
        isShrunk = false;
      }
    };
    window.addEventListener('scroll', toggleShrink, { passive: true });
    toggleShrink();
  }

  // Clicar na foto (expandida ou compacta) volta pro topo
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  if (photoCircle) {
    photoCircle.style.cursor = 'pointer';
    photoCircle.addEventListener('click', scrollToTop);
  }
  if (compactPhoto) {
    compactPhoto.addEventListener('click', scrollToTop);
  }

  // ============ STICKY MINI HEADER (mobile) ============ 
  const stickyMiniHeader = document.getElementById('stickyMiniHeader');
  let lastScrollY = 0;
  if (stickyMiniHeader) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      if (scrollY > 200 && scrollY < lastScrollY) {
        stickyMiniHeader.classList.add('show');
      } else {
        stickyMiniHeader.classList.remove('show');
      }
      lastScrollY = scrollY;
    });
  }

  // ============ MOBILE TABS & SCROLL SPY ============ 
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });

  const sections = ['sec-dados', 'sec-habilidades', 'sec-projetos', 'sec-experiencia']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tabBtns.forEach(b => b.classList.toggle('active', b.dataset.target === entry.target.id));
        }
      });
    }, { rootMargin: '-70px 0px -65% 0px', threshold: 0 });

    sections.forEach(s => spy.observe(s));
  }
});
