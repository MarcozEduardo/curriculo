/*
 * video_loader_mask.js
 * Força o carregamento de iframes (YouTube) no modal de projetos.
 * Exibe uma máscara por 3s, depois simula o clique em "Voltar para o vídeo".
 */
(function() {
  let loadingTimeout = null;
  let isFirstOpen = true;

  const modal = document.getElementById('projectModal');
  if (!modal) return;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        if (modal.classList.contains('open')) {
          handleModalOpen();
        } else {
          clearTimeout(loadingTimeout);
          const loader = document.getElementById('fake-video-loader');
          if (loader) loader.remove();
        }
      }
    });
  });

  observer.observe(modal, { attributes: true });

  function handleModalOpen() {
    if (!isFirstOpen) return;

    // Espera o modal montar o DOM
    setTimeout(() => {
      const mediaArea = modal.querySelector('.pm-media');
      const preview = modal.querySelector('.pm-preview');
      if (!mediaArea || !preview) return;

      // Verifica se tem vídeo
      const hasVideo = preview.querySelector('iframe');
      if (!hasVideo) {
        isFirstOpen = false;
        return;
      }

      // Cria a máscara
      const loader = document.createElement('div');
      loader.id = 'fake-video-loader';
      loader.innerHTML = '<div class="fake-spinner"></div><div class="fake-text">CARREGANDO VÍDEO...</div>';
      
      // Estilo inline pra garantir
      loader.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:#161b22; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; color:#fff; font-family:monospace; border-radius:8px;';

      const style = document.createElement('style');
      style.innerHTML = '@keyframes fakeSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
      document.head.appendChild(style);

      mediaArea.style.position = 'relative';
      mediaArea.appendChild(loader);

      // Se o cara clicar numa foto, cancela a máscara e deixa o botão aparecer
      const cancelLoader = () => {
        clearTimeout(loadingTimeout);
        if (loader && loader.parentNode) loader.remove();
      };

      const thumbs = modal.querySelectorAll('.pm-thumb');
      thumbs.forEach(t => t.addEventListener('click', cancelLoader, { once: true }));

      // Timer de 3s
      loadingTimeout = setTimeout(() => {
        cancelLoader();
        
        // Procura o botão de voltar pro vídeo e clica nele
        const buttons = preview.querySelectorAll('button');
        for (let btn of buttons) {
          const txt = btn.textContent.toLowerCase();
          if (txt.includes('vídeo') || txt.includes('video')) {
            btn.click();
            break;
          }
        }
        isFirstOpen = false;
      }, 3000);

    }, 100);
  }
})();
