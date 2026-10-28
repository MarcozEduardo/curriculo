/**
 * Galeria de Projetos — Modal
 * Isolado. Não toca em pdf-mode, ui, chat, focus.
 */
(function () {
  'use strict';

  const INDEX_URL = 'data/projects_media.json';

  const COLOR = {
    video: { bg: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', label: 'VÍDEO', icon: 'fa-video' },
    capa:  { bg: 'linear-gradient(135deg, #16a34a 0%, #166534 100%)', label: 'CAPA',  icon: 'fa-image' },
    p1:    { bg: 'linear-gradient(135deg, #eab308 0%, #a16207 100%)', label: 'FOTO 1', icon: 'fa-image' },
    p2:    { bg: 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)', label: 'FOTO 2', icon: 'fa-image' },
    p3:    { bg: 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)', label: 'FOTO 3', icon: 'fa-image' }
  };

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function placeholderDiv(kind) {
    const c = COLOR[kind] || COLOR.capa;
    const d = el('div', 'pm-media-placeholder', '<i class="fa-solid ' + c.icon + '"></i><span>' + c.label + '</span>');
    d.style.background = c.bg;
    return d;
  }

  // Imagem com fallback: mostra placeholder enquanto carrega; se falhar, fica no placeholder
  function imgWithFallback(src, alt, kind) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
    const ph = placeholderDiv(kind);
    ph.style.position = 'absolute';
    ph.style.inset = '0';
    ph.style.zIndex = '1';
    wrap.appendChild(ph);
    const img = el('img');
    img.src = src;
    img.alt = alt;
    img.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block;z-index:2;';
    img.onload = function () { if (ph.parentNode) ph.remove(); };
    img.onerror = function () { if (img.parentNode) img.remove(); };
    wrap.appendChild(img);
    return wrap;
  }

  function youtubeEmbed(url) {
    if (!url) return null;
    const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (!m) return null;
    const id = m[1];

    // Facade: thumbnail + botão play. Só carrega iframe real ao clicar.
    const facade = document.createElement('div');
    facade.className = 'pm-yt-facade';

    const poster = document.createElement('img');
    poster.alt = 'Vídeo do projeto';
    poster.src = 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg';
    poster.onerror = function () { poster.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; };
    facade.appendChild(poster);

    const btn = document.createElement('div');
    btn.className = 'pm-yt-playbtn';
    btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    facade.appendChild(btn);

    facade.addEventListener('click', function () {
      facade.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&autoplay=1&color=white';
      iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      facade.appendChild(iframe);

      // Máscaras por cima do iframe (esconde branding do YouTube)
      const maskTop = document.createElement('div');
      maskTop.className = 'pm-yt-mask-top';
      facade.appendChild(maskTop);

      const maskBottom = document.createElement('div');
      maskBottom.className = 'pm-yt-mask-bottom';
      facade.appendChild(maskBottom);
    });

    return facade;
  }

  function driveEmbed(url) {
    if (!url) return null;
    const m = String(url).match(/\/file\/d\/([\w-]+)|[?&]id=([\w-]+)/);
    if (!m) return null;
    const id = m[1] || m[2];

    const wrap = document.createElement('div');
    wrap.className = 'pm-drive-wrap';

    const iframe = document.createElement('iframe');
    iframe.src = 'https://drive.google.com/file/d/' + id + '/preview';
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    wrap.appendChild(iframe);

    return wrap;
  }

  function buildMediaArea(info, basePath) {
    const media = (info.media) || {};
 const demo = media.demo === true;
 const row = el('div', 'pm-media-row');
  // Main media — prioridade: Drive > YouTube > vídeo local > capa > placeholder
  const mainWrap = el('div', 'pm-main-media');
  if (media.drive && !demo) {
    const emb = driveEmbed(media.drive);
    if (emb) mainWrap.appendChild(emb);
    else if (media.capa) mainWrap.appendChild(imgWithFallback(basePath + '/' + media.capa, info.nome, 'capa'));
  } else if (media.youtube && !demo) {
    const emb = youtubeEmbed(media.youtube);
    if (emb) mainWrap.appendChild(emb);
    else if (media.video) mainWrap.appendChild(placeholderDiv('video'));
    else if (media.capa) mainWrap.appendChild(placeholderDiv('capa'));
  } else if (media.video && !demo) {
    const v = el('video');
    v.src = media.video.startsWith('http') ? media.video : basePath + '/' + media.video;
    v.muted = true; v.autoplay = true; v.loop = true; v.playsInline = true;
    mainWrap.appendChild(v);
  } else if (media.capa && !demo) {
    mainWrap.appendChild(imgWithFallback(basePath + '/' + media.capa, info.nome, 'capa'));
  } else {
    if (media.drive || media.youtube || media.video) mainWrap.appendChild(placeholderDiv('video'));
    else if (media.capa) mainWrap.appendChild(placeholderDiv('capa'));
  }

  row.appendChild(mainWrap);



    // VÍDEOS EXTRAS (playlist YouTube)
  const extras = media.youtube_extra || [];
  if (extras.length > 0) {
    const extraRow = el("div", "pm-extra-videos");
    extraRow.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;";
    extras.forEach(function (url) {
      const wrap = el("div");
      wrap.style.cssText = "aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:#000;";
      const emb = youtubeEmbed(url);
      if (emb) wrap.appendChild(emb);
      extraRow.appendChild(wrap);
    });
    row.style.flexDirection = "column";
    row.appendChild(extraRow);
  }

// Prints column
    const prints = media.prints || [];
    if (prints.length > 0) {
      const thumbs = el('div', 'pm-thumbs');
      prints.slice(0, 3).forEach(function (p, i) {
        const t = el('div', 'pm-thumb');
        if (demo) {
          const kind = i === 0 ? 'p1' : i === 1 ? 'p2' : 'p3';
          t.appendChild(placeholderDiv(kind));
        } else {
          const kind = i === 0 ? 'p1' : i === 1 ? 'p2' : 'p3';
          t.appendChild(imgWithFallback(basePath + '/' + p, 'Print ' + (i + 1), kind));
          const lb = el('span', 'pm-thumb-label', 'FOTO ' + (i + 1));
          t.appendChild(lb);
        }
        thumbs.appendChild(t);
      });
      row.appendChild(thumbs);
    } else {
      row.classList.add('single');
    }

    return row;
  }

  function formatBold(text) {
    if (!text) return '';
    return String(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function buildContent(info) {
    const c = el('div', 'pm-content');

    // Título + CTA lado a lado
    const titleRow = el('div', 'pm-title-row');
    titleRow.appendChild(el('h1', 'pm-title', info.nome || ''));
    const cta = info.cta || {};
 if (cta.url && cta.label) {
   const link = el('a', 'pm-cta pm-cta-inline', '<i class="fa-solid ' + (cta.icone || 'fa-external-link-alt') + '"></i> ' + cta.label);
   link.href = cta.url;
   link.target = '_blank';
   link.rel = 'noopener';
   titleRow.appendChild(link);
 } else if (info.status_label) {
   titleRow.appendChild(el('span', 'pm-status-badge', '<i class="fa-solid fa-wrench"></i> ' + info.status_label));
 }
    c.appendChild(titleRow);

    if (info.subtitulo) c.appendChild(el('p', 'pm-subtitle', info.subtitulo));
    if (Array.isArray(info.stack) && info.stack.length) {
      const s = el('div', 'pm-stack');
      info.stack.forEach(function (t) { s.appendChild(el('span', null, t)); });
      c.appendChild(s);
    }
    if (info.descricao) {
      const descCard = el('div', 'pm-desc-card');
      const descHead = el('div', 'pm-desc-head', '<i class="fa-solid fa-circle-info"></i>Sobre o projeto');
      descCard.appendChild(descHead);
      descCard.appendChild(el('p', 'pm-desc', formatBold(info.descricao)));
      c.appendChild(descCard);
    }
    return c;
  }

  function ensureModal() {
    let m = document.getElementById('pmOverlay');
    if (m) return m;
    m = el('div', 'pm-overlay');
    m.id = 'pmOverlay';
    m.innerHTML = '<div class="pm-frame"></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target === m) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m.classList.contains('open')) {
      const lb = document.getElementById('pmLightbox');
      if (lb && lb.classList.contains('open')) return;
      closeModal();
    }
    });
    return m;
  }

  function closeModal() {
    const m = document.getElementById('pmOverlay');
    if (!m) return;
    // Para qualquer vídeo/iframe antes de esconder (evita áudio fantasma)
    m.querySelectorAll('iframe, video').forEach(function (media) {
      try {
        if (media.tagName === 'VIDEO') { media.pause(); media.removeAttribute('src'); media.load(); }
        else { media.src = 'about:blank'; }
      } catch (e) { /* ignora cross-origin */ }
    });
    m.classList.remove('open');
    document.body.classList.remove('modal-open');
    // Limpa o conteúdo depois do fade pra liberar o iframe de vez
    setTimeout(function () {
      const frame = m.querySelector('.pm-frame');
      if (frame) frame.innerHTML = '';
    }, 300);
  }

  /* ============ LIGHTBOX DE FOTO (zoom + pan + navegação) ============ */
const lbState = {
  items: [],
  index: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  dragging: false,
  startX: 0,
  startY: 0,
  startPanX: 0,
  startPanY: 0,
  initialDist: 0,
  initialZoom: 1
};

function ensureLightbox() {
  let lb = document.getElementById('pmLightbox');
  if (lb) return lb;
  lb = el('div', 'pm-lightbox');
  lb.id = 'pmLightbox';
  lb.innerHTML = '<div class="pm-lb-counter"><span class="pm-lb-idx">1</span> / <span class="pm-lb-total">1</span></div>' +
    '<div class="pm-lb-toolbar">' +
    '  <button class="pm-lb-btn" type="button" data-lb="zoom-out" title="Reduzir"><i class="fa-solid fa-magnifying-glass-minus"></i></button>' +
    '  <button class="pm-lb-btn" type="button" data-lb="zoom-in" title="Ampliar"><i class="fa-solid fa-magnifying-glass-plus"></i></button>' +
    '  <button class="pm-lb-btn" type="button" data-lb="close" title="Fechar"><i class="fa-solid fa-xmark"></i></button>' +
    '</div>' +
    '<button class="pm-lb-nav pm-lb-prev" type="button" data-lb="prev" title="Anterior"><i class="fa-solid fa-chevron-left"></i></button>' +
    '<button class="pm-lb-nav pm-lb-next" type="button" data-lb="next" title="Próxima"><i class="fa-solid fa-chevron-right"></i></button>' +
    '<div class="pm-lb-stage"><img class="pm-lb-img" alt="Foto do projeto"></div>';
  document.body.appendChild(lb);
  bindLightboxEvents(lb);
  return lb;
}

function applyLbTransform() {
  const img = document.querySelector('#pmLightbox .pm-lb-img');
  const stage = document.querySelector('#pmLightbox .pm-lb-stage');
  if (!img || !stage) return;
  const maxX = stage.clientWidth * 0.45 * (lbState.zoom - 1) / lbState.zoom;
  const maxY = stage.clientHeight * 0.45 * (lbState.zoom - 1) / lbState.zoom;
  lbState.panX = Math.max(-maxX, Math.min(maxX, lbState.panX));
  lbState.panY = Math.max(-maxY, Math.min(maxY, lbState.panY));
  img.style.transform = 'translate(' + lbState.panX + 'px, ' + lbState.panY + 'px) scale(' + lbState.zoom + ')';
}

function setLbImage(i) {
  if (!lbState.items.length) return;
  lbState.index = ((i % lbState.items.length) + lbState.items.length) % lbState.items.length;
  const it = lbState.items[lbState.index];
  const img = document.querySelector('#pmLightbox .pm-lb-img');
  img.src = it.src;
  img.alt = it.alt || '';
  lbState.zoom = 1;
  lbState.panX = 0;
  lbState.panY = 0;
  applyLbTransform();
  const idxEl = document.querySelector('#pmLightbox .pm-lb-idx');
  const totEl = document.querySelector('#pmLightbox .pm-lb-total');
  if (idxEl) idxEl.textContent = lbState.index + 1;
  if (totEl) totEl.textContent = lbState.items.length;
  updateLbButtons();
}

function updateLbButtons() {
  const prev = document.querySelector('#pmLightbox [data-lb="prev"]');
  const next = document.querySelector('#pmLightbox [data-lb="next"]');
  const zOut = document.querySelector('#pmLightbox [data-lb="zoom-out"]');
  const zIn = document.querySelector('#pmLightbox [data-lb="zoom-in"]');
  if (prev) prev.disabled = lbState.items.length <= 1;
  if (next) next.disabled = lbState.items.length <= 1;
  if (zOut) zOut.disabled = lbState.zoom <= 1;
  if (zIn) zIn.disabled = lbState.zoom >= 5;
}

function openLightbox(items, startIndex) {
  if (!items || !items.length) return;
  lbState.items = items;
  const lb = ensureLightbox();
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
  setLbImage(startIndex || 0);
}

function closeLightbox() {
  const lb = document.getElementById('pmLightbox');
  if (!lb) return;
  lb.classList.remove('open');
  document.body.style.overflow = '';
  lbState.zoom = 1;
  lbState.panX = 0;
  lbState.panY = 0;
}

function bindLightboxEvents(lb) {
  lb.addEventListener('click', function (e) {
    const t = e.target.closest('[data-lb]');
    if (!t) {
      if (e.target.classList.contains('pm-lb-stage')) closeLightbox();
      return;
    }
    const action = t.getAttribute('data-lb');
    if (action === 'close') closeLightbox();
    else if (action === 'prev') setLbImage(lbState.index - 1);
    else if (action === 'next') setLbImage(lbState.index + 1);
    else if (action === 'zoom-in') { lbState.zoom = Math.min(5, lbState.zoom + 0.5); applyLbTransform(); updateLbButtons(); }
    else if (action === 'zoom-out') { lbState.zoom = Math.max(1, lbState.zoom - 0.5); if (lbState.zoom === 1) { lbState.panX = 0; lbState.panY = 0; } applyLbTransform(); updateLbButtons(); }
  });

  lb.addEventListener('wheel', function (e) {
    if (!lb.classList.contains('open')) return;
    if (e.target.closest('.pm-lb-img') || e.target.closest('.pm-lb-stage')) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      lbState.zoom = Math.max(1, Math.min(5, lbState.zoom + delta));
      if (lbState.zoom === 1) { lbState.panX = 0; lbState.panY = 0; }
      applyLbTransform();
      updateLbButtons();
    }
  }, { passive: false });

  const stage = lb.querySelector('.pm-lb-stage');
  stage.addEventListener('mousedown', function (e) {
    if (lbState.zoom <= 1) return;
    e.preventDefault();
    lbState.dragging = true;
    lbState.startX = e.clientX;
    lbState.startY = e.clientY;
    lbState.startPanX = lbState.panX;
    lbState.startPanY = lbState.panY;
    stage.classList.add('dragging');
  });
  window.addEventListener('mousemove', function (e) {
    if (!lbState.dragging) return;
    lbState.panX = lbState.startPanX + (e.clientX - lbState.startX);
    lbState.panY = lbState.startPanY + (e.clientY - lbState.startY);
    applyLbTransform();
  });
  window.addEventListener('mouseup', function () {
    if (lbState.dragging) { lbState.dragging = false; stage.classList.remove('dragging'); }
  });

  stage.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lbState.initialDist = Math.hypot(dx, dy);
      lbState.initialZoom = lbState.zoom;
    } else if (e.touches.length === 1 && lbState.zoom > 1) {
      lbState.dragging = true;
      lbState.startX = e.touches[0].clientX;
      lbState.startY = e.touches[0].clientY;
      lbState.startPanX = lbState.panX;
      lbState.startPanY = lbState.panY;
    }
  }, { passive: true });

  stage.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2 && lbState.initialDist > 0) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / lbState.initialDist;
      lbState.zoom = Math.max(1, Math.min(5, lbState.initialZoom * ratio));
      applyLbTransform();
      updateLbButtons();
    } else if (e.touches.length === 1 && lbState.dragging) {
      e.preventDefault();
      lbState.panX = lbState.startPanX + (e.touches[0].clientX - lbState.startX);
      lbState.panY = lbState.startPanY + (e.touches[0].clientY - lbState.startY);
      applyLbTransform();
    }
  }, { passive: false });

  stage.addEventListener('touchend', function () {
    lbState.dragging = false;
    lbState.initialDist = 0;
  });

  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') { closeLightbox(); }
    else if (e.key === 'ArrowLeft') setLbImage(lbState.index - 1);
    else if (e.key === 'ArrowRight') setLbImage(lbState.index + 1);
    else if (e.key === '+' || e.key === '=') { lbState.zoom = Math.min(5, lbState.zoom + 0.5); applyLbTransform(); updateLbButtons(); }
    else if (e.key === '-') { lbState.zoom = Math.max(1, lbState.zoom - 0.5); applyLbTransform(); updateLbButtons(); }
  });
}

async function openProject(id) {
    let index;
    try {
      const r = await fetch(INDEX_URL);
      index = await r.json();
    } catch (e) {
      console.error('[PM] não consegui ler o índice:', e);
      return;
    }
    const infoPath = (index.projetos || {})[id];
    if (!infoPath) { console.warn('[PM] projeto não indexado:', id); return; }

    let info;
    try {
      const r = await fetch(infoPath);
      info = await r.json();
    } catch (e) {
      console.error('[PM] não consegui ler info.json:', e);
      return;
    }

    const basePath = infoPath.replace(/\/info\.json$/, '');
    const overlay = ensureModal();
    const frame = overlay.querySelector('.pm-frame');
    frame.innerHTML = '';

    const bar = el('div', 'pm-bar');
    bar.innerHTML = '<span class="pm-bar-title">Galeria do Projeto</span><span class="pm-bar-sub">' + (info.nome || '') + '</span>';
    const closeBtn = el('button', 'pm-close', '<i class="fa-solid fa-xmark"></i>');
    closeBtn.addEventListener('click', closeModal);
    bar.appendChild(closeBtn);

    const body = el('div', 'pm-body');
    const mediaArea = buildMediaArea(info, basePath);
    body.appendChild(mediaArea);
    body.appendChild(buildContent(info));

    // Thumbs clicáveis — clica na foto, ela vai pra posição principal
    const mainWrap = mediaArea.querySelector('.pm-main-media');
    if (mainWrap) {
      const originalChildren = Array.from(mainWrap.children);

  // Coleta itens para a lightbox (todas as imagens dos thumbs)
  const printItems = [];
  mediaArea.querySelectorAll('.pm-thumb').forEach(function (t, thumbIdx) {
    const img = t.querySelector('img');
    if (img && img.src) printItems.push({ src: img.src, alt: img.alt || 'Foto do projeto' });
  });

      mediaArea.querySelectorAll('.pm-thumb').forEach(function (t, thumbIdx) {
          t.addEventListener('click', function () {
          const media = t.querySelector('img, .pm-media-placeholder');
          if (!media) return;

          // Esconde o conteúdo original (vídeo/iframe/capa) sem destruir
          originalChildren.forEach(function (c) { if (c.parentNode === mainWrap) c.style.display = 'none'; });

          // Remove preview/button anteriores se houver
          const prevPreview = mainWrap.querySelector('.pm-thumb-preview');
          if (prevPreview) prevPreview.remove();
          const prevBtn = mainWrap.querySelector('.pm-back-to-video');
          if (prevBtn) prevBtn.remove();

          // Coloca a imagem do thumb em destaque
          const preview = document.createElement('div');
          preview.className = 'pm-thumb-preview';
          const imgClone = media.cloneNode(true);
          imgClone.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          preview.appendChild(imgClone);
          preview.style.cursor = 'zoom-in';
preview.addEventListener('click', function () {
  openLightbox(printItems, thumbIdx);
});
mainWrap.appendChild(preview);

          // Botão voltar ao vídeo
          const backBtn = document.createElement('button');
          backBtn.className = 'pm-back-to-video';
          backBtn.type = 'button';
          backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Voltar ao vídeo';
          backBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            preview.remove();
            backBtn.remove();
            originalChildren.forEach(function (c) { c.style.display = ''; });
            mediaArea.querySelectorAll('.pm-thumb').forEach(function (x) { x.classList.remove('active'); });
          });
          mainWrap.appendChild(backBtn);

          mediaArea.querySelectorAll('.pm-thumb').forEach(function (x) { x.classList.remove('active'); });
          t.classList.add('active');
        });
      });
    }

    const footer = el('footer', 'pm-footer',
      '<span>Currículo Inteligente</span>' +
      '<span class="pm-footer-dot">•</span>' +
      '<span>Marcos Eduardo</span>' +
      '<span class="pm-footer-dot">•</span>' +
      '<span>QA Engineer · Orquestração de IA</span>'
    );

    frame.appendChild(bar);
    frame.appendChild(body);
    frame.appendChild(footer);

    overlay.classList.add('open');
    document.body.classList.add('modal-open');
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-project-gallery]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openProject(btn.getAttribute('data-project-gallery'));
      });
    });
  });

  window.ProjectModal = { open: openProject, close: closeModal };
})();
