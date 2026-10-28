/*
 * video_loader_mask.js
 * Força o carregamento de vídeos do YouTube no modal de projetos.
 * Finge uma transição (foto -> voltar pro vídeo) por baixo de uma máscara.
 */
(function() {
  let loadingTimeout = null;
  const projetosCarregados = new Set();
  let currentProjectId = null;

  // Observa a abertura do modal
  const observer = new MutationObserver((mutations) => {
    const overlay = document.getElementById('pmOverlay');
    if (!overlay) return;

    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        if (overlay.classList.contains('open')) {
          // Espera o DOM do modal ser montado (o project-modal.js leva uns ms pra montar)
          setTimeout(() => handleModalOpen(overlay), 150);
        } else {
          clearTimeout(loadingTimeout);
          removeMask();
        }
      }
    });
  });

  // Tenta observar o body pra pegar quando o #pmOverlay for criado
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

    // Descobre qual projeto está aberto pela URL do info.json ou pelo título
    const title = frame.querySelector('.pm-bar-sub')?.textContent || '';
    const projectKey = title.trim();
    if (!projectKey) return;

    // Se já carregou esse projeto nessa sessão, não faz de novo
    if (projetosCarregados.has(projectKey)) return;

    const mainMedia = frame.querySelector('.pm-main-media');
    const facade = mainMedia ? mainMedia.querySelector('.pm-yt-facade') : null;
    
    // Se não tem facade de YouTube, ignora (ex: RAG que usa Drive)
    if (!facade) {
      projetosCarregados.add(projectKey);
      return;
    }

    // Pega o primeiro thumb pra fazer a falsa transição
    const firstThumb = frame.querySelector('.pm-thumb');
    if (!firstThumb) return;

    // 1. Clica no thumb (esconde o vídeo e mostra a foto + botão voltar)
    firstThumb.click();

    // 2. Coloca a máscara por cima
    setTimeout(() => {
      const mediaArea = frame.querySelector('.pm-media-row');
      if (!mediaArea) return;
      
      mediaArea.style.position = 'relative';
      const loader = document.createElement('div');
      loader.id = 'fake-video-loader';
      loader.innerHTML = '<div class="fake-spinner"></div><div class="fake-text">CARREGANDO VÍDEO...</div>';
      loader.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:#0e1116; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; color:#fff; font-family:monospace; border-radius:8px;';
      
      if (!document.getElementById('fake-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'fake-spinner-style';
        style.innerHTML = '@keyframes fakeSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
        document.head.appendChild(style);
      }
      
      mediaArea.appendChild(loader);

      // 3. Se o usuário clicar em qualquer thumb, cancela a máscara
      const cancelLoader = () => {
        clearTimeout(loadingTimeout);
        removeMask();
        projetosCarregados.add(projectKey);
      };
      frame.querySelectorAll('.pm-thumb').forEach(t => t.addEventListener('click', cancelLoader, { once: true }));

      // 4. Timer de 3s: clica no botão de voltar e remove a máscara
      loadingTimeout = setTimeout(() => {
        const backBtn = mainMedia.querySelector('.pm-back-to-video');
        if (backBtn) backBtn.click(); // Força o vídeo a renderizar
        removeMask();
        projetosCarregados.add(projectKey);
      }, 3000);
    }, 50);
  }
})();
