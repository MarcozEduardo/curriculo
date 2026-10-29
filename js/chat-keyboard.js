(function () {
  'use strict';
  function init() {
    var chatModal = document.getElementById('chatModal');
    var chatBox = document.querySelector('.chat-box');
    if (!chatModal || !chatBox) return;
    var vv = window.visualViewport;
    function applyHeight() {
      if (!chatModal.classList.contains('open') || window.innerWidth > 700) {
        chatBox.style.height = '';
        chatBox.style.maxHeight = '';
        return;
      }
      var h = vv ? vv.height : window.innerHeight;
      if (h > 0) {
        chatBox.style.height = h + 'px';
        chatBox.style.maxHeight = h + 'px';
      }
    }
    if (vv) {
      vv.addEventListener('resize', applyHeight);
      vv.addEventListener('scroll', applyHeight);
    }
    window.addEventListener('resize', applyHeight);
    window.addEventListener('orientationchange', function () { setTimeout(applyHeight, 200); });
    var observer = new MutationObserver(function () {
      if (chatModal.classList.contains('open')) {
        requestAnimationFrame(applyHeight);
        setTimeout(applyHeight, 150);
        setTimeout(applyHeight, 400);
      } else {
        applyHeight();
      }
    });
    observer.observe(chatModal, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
