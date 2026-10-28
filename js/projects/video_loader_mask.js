/*
 * video_loader_mask.js
 * Força o carregamento de vídeos do Google Drive no modal de projetos.
 * A máscara cobre APENAS a área principal do vídeo, deixando as fotos visíveis.
 */
(function() {
  let loadingTimeout = null;
  const projetosCarregados = new Set();

  const observer = new MutationObserver((mutations) => {
    const overlay = document.getElementById('pmOverlay');
    if (!overlay) return;

    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        if (overlay.classList.contains('open')) {
          setTimeout(() => handleModalOpen(overlay), 100);
        } else {
          clearTimeout(loadingTimeout);
          removeMask();
        }
      }
    });
  });

  const bodyObserver = new MutationObserver(() => {
    const overlay = document.getElementById('pmOverlay');
    if (overlay) {
      bodyObserver.disconnect();
      observer.observe(overlay, { attributes: true });
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });

  function removeMask() {
    const loader = document.getElementById('fake-video-loader');
    if (loader) loader.remove();
  }

  function handleModalOpen(overlay) {
    const frame = overlay.querySelector('.pm-frame');
    if (!frame) return;

    const title = frame.querySelector('.pm-bar-sub')?.textContent || '';
    if (!title) return;

    if (projetosCarregados.has(title)) return;

    const mainMedia = frame.querySelector('.pm-main-media');
    if (!mainMedia) return;

    // Procura o wrapper do Google Drive (.pm-drive-wrap)
    const driveWrap = mainMedia.querySelector('.pm-drive-wrap');
    if (!driveWrap) {
      projetosCarregados.add(title);
      return;
    }

    const firstThumb = frame.querySelector('.pm-thumb');
    if (!firstThumb) return;

    // Simula o clique na foto (faz a foto aparecer e cria o botão "Voltar ao vídeo")
    firstThumb.click();

    setTimeout(() => {
      const backBtn = mainMedia.querySelector('.pm-back-to-video');
      if (backBtn) backBtn.style.display = 'none';

      const loader = document.createElement('div');
      loader.id = 'fake-video-loader';
      loader.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:#1c232c; color:#fff; font-family:monospace; position:absolute; top:0; left:0; z-index:10; border-radius:8px;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size:32px; margin-bottom:12px; color:#ff7b3d;"></i>
          <span style="font-weight:600; letter-spacing:1px;">CARREGANDO VÍDEO...</span>
        </div>
      `;
      mainMedia.style.position = 'relative';
      mainMedia.appendChild(loader);

      const thumbsContainer = frame.querySelector('.pm-thumbs');
      const cancelLoader = () => {
        clearTimeout(loadingTimeout);
        removeMask();
        if (backBtn) backBtn.style.display = '';
        projetosCarregados.add(title);
      };

      if (thumbsContainer) {
        thumbsContainer.addEventListener('click', cancelLoader, { once: true });
      }

      loadingTimeout = setTimeout(() => {
        removeMask();
        if (backBtn) {
          backBtn.style.display = '';
          backBtn.click();
        }
        projetosCarregados.add(title);
      }, 3000);

    }, 50);
  }
})();
