/**
 * PDF Generator + Preview Interno
 * - download(): usa html2pdf.bundle (a lib que funcionava na msg 78)
 * - enter()/exit(): preview interno (Ctrl+Shift+P)
 */
const PdfPreview = (() => {
  let toolbarEl = null;
  let pagesEl = null;
  let isActive = false;

  const PAGES = [
    {
      selectors: [
        '.app-header-expanded',
        '#divider-sobre',
        '#sec-sobre',
        '.sheet-grid',
        '#divider-habilidades',
        '#sec-habilidades'
      ]
    },
    { selectors: ['#sec-projetos'] },
    {
      selectors: [
        '#sec-diferenciais',
        '#sec-experiencia',
        '#divider-orquestracao',
        '#sec-orquestracao',
        '.pcd-footer-note',
        '.footer'
      ]
    }
  ];

  /* ---------- QR ---------- */
  function buildQRBlock() {
    const wrap = document.createElement('div');
    wrap.className = 'pdf-qr-wrap';
    const url = window.location.href.split('#')[0] || 'https://curriculo-marcos.vercel.app';

    // Título ACIMA (fora do bloco laranja)
    const title = document.createElement('div');
    title.className = 'pdf-qr-title';
    title.textContent = 'Vem pro Currículo Inteligente';

    // Bloco laranja com QR como <a> clicável (link no PDF)
    const qrBlock = document.createElement('div');
    qrBlock.className = 'pdf-qr-block';
    const qrBox = document.createElement('a');
    qrBox.className = 'pdf-qr-box';
    qrBox.href = url;
    qrBox.target = '_blank';
    qrBox.rel = 'noopener';
    try {
      if (window.qrcode) {
        const qr = window.qrcode(0, 'H');
        qr.addData(url);
        qr.make();
        const dataUrl = qr.createDataURL(8, 0);
        qrBox.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;display:block;object-fit:contain;" alt="QR">';
      } else {
        qrBox.innerHTML = '<div class="pdf-qr-fallback">QR indisponível</div>';
      }
    } catch (e) {
      qrBox.innerHTML = '<div class="pdf-qr-fallback">QR indisponível</div>';
    }
    const centerM = document.createElement('div');
    centerM.className = 'pdf-qr-m';
    centerM.textContent = 'M';
    qrBox.appendChild(centerM);
    qrBlock.appendChild(qrBox);

    // Info ABAIXO (fora do bloco laranja)
    const info = document.createElement('div');
    info.className = 'pdf-qr-info';
    info.textContent = 'Leia o QR Code ou clique';

    wrap.appendChild(title);
    wrap.appendChild(qrBlock);
    wrap.appendChild(info);
    return wrap;
  }

  /* ---------- Construtor de páginas (sem cloneNode) ---------- */
  function buildPagesInto(container) {
    container.innerHTML = '';
    const frame = document.getElementById('captureArea');
    if (!frame) return 0;

    PAGES.forEach((pageDef, idx) => {
      const page = document.createElement('div');
      page.className = 'pdf-page';
      const body = document.createElement('div');
      body.className = 'pdf-page-body';

      pageDef.selectors.forEach((sel) => {
        const src = frame.querySelector(sel) || document.querySelector(sel);
        if (!src) return;
        // Extrai HTML como STRING e reparseia (evita cloneNode e estado herdado)
        const html = src.outerHTML;
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const fresh = tmp.firstElementChild;
        if (!fresh) return;
        fresh.classList.add('pdf-block');
        if (sel === '.app-header-expanded' && idx === 0) {
          fresh.appendChild(buildQRBlock());
        }
        body.appendChild(fresh);
      });

      const foot = document.createElement('div');
      foot.className = 'pdf-page-footer';
      foot.textContent = 'Página ' + (idx + 1) + ' de ' + PAGES.length;

      page.appendChild(body);
      page.appendChild(foot);
      container.appendChild(page);
    });

    return PAGES.length;
  }

  /* ---------- Toast ---------- */
  function pdfToast(message, icon = 'fa-circle-exclamation') {
    const existing = document.getElementById('pdfToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'pdfToast';
    toast.className = 'pdf-toast';
    toast.innerHTML = '<i class="fa-solid ' + icon + '"></i> <span>' + message + '</span>';
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /* ---------- Progress overlay ---------- */
  function ensureProgress() {
    let el = document.getElementById('pdfProgressOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pdfProgressOverlay';
    el.className = 'pdf-progress-overlay';
    el.innerHTML =
      '<div class="pdf-progress-box">' +
      '  <div class="pp-spinner"><i class="fa-solid fa-file-pdf"></i></div>' +
      '  <div class="pp-title">Montando PDF</div>' +
      '  <div class="pp-step" id="pdfProgressStep">Preparando...</div>' +
      '  <div class="pp-bar"><div class="pp-bar-fill" id="pdfProgressBar"></div></div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function setProgress(text, pct) {
    const step = document.getElementById('pdfProgressStep');
    const bar = document.getElementById('pdfProgressBar');
    if (step) step.textContent = text;
    if (bar) bar.style.width = pct + '%';
  }

/* ---------- Download · versão que funciona + overlay antes ---------- */
function download() {
  if (!window.html2pdf) {
    pdfToast('html2pdf não carregado.', 'fa-triangle-exclamation');
    return;
  }

  // 1. Overlay INSTANTÂNEO (cobre tudo antes do preview aparecer)
  const progress = ensureProgress();
  progress.classList.add('show');
  progress.style.setProperty('display', 'flex', 'important');
  setProgress('Iniciando...', 5);

  const wasActive = isActive;

  // 2. Zera padding do body + esconde toolbar (inline vence CSS externo)
  document.body.style.setProperty('padding', '0', 'important');
  document.body.style.setProperty('margin', '0', 'important');
  document.querySelectorAll('.pdf-toolbar').forEach(el => el.style.setProperty('display', 'none', 'important'));

  // 3. Só abre o preview depois de 2 frames (overlay já pintado)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!wasActive) enter();
    });
  });

  // 3. Espera o preview montar (1500ms) e captura
  setTimeout(() => {
    const target = pagesEl || document.querySelector('.pdf-pages');
    if (!target) {
      pdfToast('Preview indisponível.', 'fa-triangle-exclamation');
      progress.classList.remove('show');
      if (!wasActive) exit();
      return;
    }

    setProgress('Preparando PDF...', 20);

    // Zera gap entre páginas (inline vence CSS externo)
    target.style.setProperty('gap', '0', 'important');
    target.style.setProperty('padding', '0', 'important');
    target.style.setProperty('margin', '0', 'important');

    // Aplica inline nos .pdf-page (que já foram montados pelo enter())
    const pageNodes = target.querySelectorAll('.pdf-page');
    pageNodes.forEach(p => {
      p.style.setProperty('display', 'block', 'important');
      p.style.setProperty('width', '210mm', 'important');
      p.style.setProperty('height', '296mm', 'important');
      p.style.setProperty('margin', '0', 'important');
      p.style.setProperty('padding', '0', 'important');
      p.style.setProperty('overflow', 'hidden', 'important');
      p.style.setProperty('box-shadow', 'none', 'important');
      const bodyEl = p.querySelector('.pdf-page-body');
      if (bodyEl) {
       bodyEl.style.setProperty('padding', '0 10mm 14mm 10mm', 'important');
        bodyEl.style.setProperty('margin', '0', 'important');
        bodyEl.style.setProperty('height', '291mm', 'important');
        bodyEl.style.setProperty('overflow', 'hidden', 'important');
        bodyEl.style.setProperty('box-sizing', 'border-box', 'important');
      }
    });

    // Customização header (primeira página)
    const firstPage = pageNodes[0];
 if (firstPage) {
   // Move o QR pra fora do header (evita corte do overflow: hidden)
   const qrWrap = firstPage.querySelector('.pdf-qr-wrap');
   const pageBody = firstPage.querySelector('.pdf-page-body');
   if (qrWrap && pageBody && qrWrap.parentNode !== pageBody) {
     pageBody.appendChild(qrWrap);
     qrWrap.style.setProperty('position', 'absolute', 'important');
     qrWrap.style.setProperty('top', '8mm', 'important');
     qrWrap.style.setProperty('right', '8mm', 'important');
     qrWrap.style.setProperty('z-index', '100', 'important');
   }
 const headerEl = firstPage.querySelector('.app-header, .app-header-expanded');
 if (headerEl) {
   headerEl.style.setProperty('background-image', 'repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 3px, transparent 3px, transparent 15px), linear-gradient(160deg, #FF8C42 0%, #FF7A2E 45%, #F26418 100%)', 'important');
   headerEl.style.setProperty('margin', '-10mm -10mm 0 -10mm', 'important');
   headerEl.style.setProperty('padding', '6mm 10mm 4mm 10mm', 'important');
   headerEl.style.setProperty('width', 'calc(100% + 20mm)', 'important');
   headerEl.style.setProperty('max-width', 'calc(100% + 20mm)', 'important');
   headerEl.style.setProperty('box-sizing', 'border-box', 'important');
   headerEl.style.setProperty('border-radius', '0', 'important');
   headerEl.style.setProperty('box-shadow', 'none', 'important');
 }
      const h1 = firstPage.querySelector('.header-name-block h1');
      if (h1) {
        h1.innerHTML = 'Marcos Eduardo';
        h1.style.setProperty('font-size', '34px', 'important');
        h1.style.setProperty('line-height', '1.1', 'important');
      }
      const photo = firstPage.querySelector('.photo-circle');
      const photoWrap = firstPage.querySelector('.photo-circle-wrap');
      if (photo) {
        photo.style.setProperty('width', '150px', 'important');
        photo.style.setProperty('height', '150px', 'important');
        photo.style.setProperty('border', '4px solid #B8420A', 'important');
        photo.style.setProperty('box-shadow', 'none', 'important');
        photo.style.setProperty('background', 'transparent', 'important');
      }
      if (photoWrap) {
        photoWrap.style.setProperty('padding', '5px', 'important');
        photoWrap.style.setProperty('border-radius', '50%', 'important');
        photoWrap.style.setProperty('background', 'rgba(255,255,255,0.75)', 'important');
        photoWrap.style.setProperty('display', 'inline-block', 'important');
      }
      const camBtn = firstPage.querySelector('.photo-add-btn');
      if (camBtn) {
        camBtn.style.setProperty('display', 'flex', 'important');
        camBtn.style.setProperty('position', 'absolute', 'important');
        camBtn.style.setProperty('bottom', '-4px', 'important');
        camBtn.style.setProperty('right', '-4px', 'important');
        camBtn.style.setProperty('width', '42px', 'important');
        camBtn.style.setProperty('height', '42px', 'important');
        camBtn.style.setProperty('background', '#B8420A', 'important');
        camBtn.style.setProperty('border', '3px solid #fff', 'important');
        camBtn.style.setProperty('border-radius', '50%', 'important');
        camBtn.style.setProperty('color', '#fff', 'important');
        camBtn.style.setProperty('align-items', 'center', 'important');
        camBtn.style.setProperty('justify-content', 'center', 'important');
        camBtn.style.setProperty('z-index', '10', 'important');
      }
      const oldTopRow = firstPage.querySelector('.header-top-row');
      const oldGithub = firstPage.querySelector('.header-github');
      if (oldTopRow) oldTopRow.style.setProperty('display', 'none', 'important');
      if (oldGithub) oldGithub.style.setProperty('display', 'none', 'important');
      const nameBlock = firstPage.querySelector('.header-name-block');
      if (nameBlock && !nameBlock.querySelector('.pdf-header-contacts')) {
        const contacts = document.createElement('div');
        contacts.className = 'pdf-header-contacts';
        contacts.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px;';
        contacts.innerHTML = '<a href="https://wa.me/5561982227804" style="display:inline-flex;align-items:center;gap:6px;color:#fff;text-decoration:none;font-size:12px;font-weight:600;background:rgba(0,0,0,0.22);padding:5px 12px;border-radius:20px;"><i class="fa-brands fa-whatsapp" style="color:#4ADE80;font-size:14px;"></i>(61) 98222-7804</a><a href="https://github.com/MarcozEduardo" style="display:inline-flex;align-items:center;gap:6px;color:#fff;text-decoration:none;font-size:12px;font-weight:600;background:rgba(0,0,0,0.22);padding:5px 12px;border-radius:20px;"><i class="fa-brands fa-github" style="font-size:14px;"></i>MarcozEduardo</a>';
        nameBlock.appendChild(contacts);
      }
      const nav = firstPage.querySelector('.focused-nav');
      if (nav) nav.style.setProperty('display', 'none', 'important');
    }

    // Cards cinza + pills maiores (todas as páginas)
    pageNodes.forEach(p => {
      p.querySelectorAll('.card').forEach(card => {
        card.style.setProperty('background', '#F8FAFC', 'important');
        card.style.setProperty('border', '1px solid #E2E8F0', 'important');
        card.style.setProperty('box-shadow', '0 1px 3px rgba(0,0,0,0.02)', 'important');
      });
      p.querySelectorAll('.pill').forEach(pill => {
        pill.style.setProperty('font-size', '11px', 'important');
        pill.style.setProperty('padding', '5px 12px', 'important');
      });
    });

    setProgress('Aguardando imagens...', 40);

 // Quebras entre páginas: NÃO injetar (cria página branca extra)
 const breaks = [];

    // Aguarda imagens carregarem
    const imgs = target.querySelectorAll('img');
    Promise.all([...imgs].map(img => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(res => { img.onload = res; img.onerror = res; setTimeout(res, 2000); });
    })).then(() => {
      setProgress('Renderizando PDF...', 60);
      const opt = {
        margin: 0,
        filename: 'Curriculo_Marcos_Eduardo.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        enableLinks: true,
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['legacy'] }
      };
      return window.html2pdf().set(opt).from(target).outputPdf('blob');
    })
    .then((blob) => {
      // VERIFICAÇÃO REAL: blob precisa existir e ter tamanho mínimo
      if (!blob || !blob.size || blob.size < 1000) {
        console.error('[PDF] blob vazio ou inválido. size:', blob ? blob.size : 0);
        setProgress('Falha na geração', 100);
        throw new Error('PDF vazio (size=' + (blob ? blob.size : 0) + ')');
      }
      console.log('[PDF] blob OK:', blob.size, 'bytes');
      setProgress('Baixando...', 90);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Curriculo_Marcos_Eduardo.pdf';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setProgress('Concluído!', 100);
      const kb = (blob.size / 1024).toFixed(1);
      setTimeout(() => pdfToast('PDF gerado: ' + kb + ' KB', 'fa-circle-check'), 800);
    })
    .catch((err) => {
      console.error('[PDF] erro:', err);
      const msg = err && err.message ? err.message : 'desconhecido';
      pdfToast('Erro: ' + msg.slice(0, 90), 'fa-triangle-exclamation');
    })
    .finally(() => {
      breaks.forEach(b => b.remove());
      // Deixa o card visível 2s após o download, depois fecha tudo
      setTimeout(() => {
        exit();
        progress.classList.remove('show');
        progress.style.removeProperty('display');
      }, 2000);
    });
  }, 1500);
}


  function ensureToolbar() {
    if (toolbarEl) return toolbarEl;
    toolbarEl = document.createElement('div');
    toolbarEl.className = 'pdf-toolbar';
    toolbarEl.innerHTML =
      '<i class="fa-solid fa-file-pdf pt-icon"></i>' +
      '<div class="pt-info"><strong>Preview Interno</strong><span id="pdfPageInfo"></span></div>' +
      '<button class="pt-close" id="pdfCloseBtn"><i class="fa-solid fa-xmark"></i> Sair</button>';
    document.body.appendChild(toolbarEl);
    toolbarEl.querySelector('#pdfCloseBtn').addEventListener('click', exit);
    return toolbarEl;
  }

  function ensurePagesEl() {
    if (pagesEl) return pagesEl;
    pagesEl = document.createElement('div');
    pagesEl.className = 'pdf-pages';
    document.body.appendChild(pagesEl);
    return pagesEl;
  }

  function enter() {
    if (isActive) return;
    isActive = true;
    ensureToolbar();
    const container = ensurePagesEl();
    document.body.classList.add('pdf-preview');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const total = buildPagesInto(container);
        const info = document.getElementById('pdfPageInfo');
        if (info) info.textContent = total + ' páginas';
      });
    });
  }

  function exit() {
    if (!isActive) return;
    isActive = false;
    document.body.classList.remove('pdf-preview');
    if (pagesEl) pagesEl.innerHTML = '';
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      if (isActive) exit();
      else enter();
    }
  });

  return { enter, exit, download };
})();

window.PdfPreview = PdfPreview;
