/* NUCLEO NEXUS · BRIDGE parent<->iframe via postMessage · ver README.md */
(function () {
  'use strict';
  function init() {
    var badge = document.getElementById('nucleoOpenBtn');
    var modal = document.getElementById('nucleoModal');
    var iframe = document.getElementById('nucleoIframe');
    var closeBtn = document.getElementById('nucleoCloseBtn');
    if (!badge || !modal || !iframe) return;
    var ready = false;
    function setupIframe() {
      try {
        var doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
        if (!doc || !doc.head) return;
        if (!doc.getElementById('nx-bridge-style')) {
          var style = doc.createElement('style');
          style.id = 'nx-bridge-style';
          style.textContent = '#fechar-nucleo { display: none !important; } .chip-header { display: none !important; }';
          doc.head.appendChild(style);
        }
        var overlay = doc.getElementById('nucleo-overlay');
        if (overlay) overlay.hidden = false;
      } catch (e) { }
    }
    function pushRealData() {
      if (!window.NucleoData) return;
      var snap = window.NucleoData.build();
      if (!snap) return;
      try {
        iframe.contentWindow.postMessage({ type: 'nucleo:snapshot', snapshot: snap }, '*');
      } catch (e) { }
    }
    iframe.addEventListener('load', function () {
      ready = true;
      setupIframe();
      setTimeout(pushRealData, 200);
      setTimeout(pushRealData, 800);
      setTimeout(pushRealData, 1500);
    });
    if (window.BobbyChat && window.BobbyChat.ranker) {
      var origAnswer = window.BobbyChat.ranker.answer;
      window.BobbyChat.ranker.answer = function (t) {
        var r = origAnswer.call(this, t);
        setTimeout(pushRealData, 300);
        return r;
      };
    }
    setInterval(pushRealData, 4000);

    var firstOpenSent = false;
    var obsFirst = new MutationObserver(function () {
      if (modal.classList.contains('open') && !firstOpenSent && ready) {
        firstOpenSent = true;
        setTimeout(function () {
          try { iframe.contentWindow.postMessage({ type: 'nucleo:first-open' }, '*'); } catch (e) {}
        }, 500);
      }
    });
    obsFirst.observe(modal, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('message', function (e) {
      if (!e.data) return;
      if (e.data.type === 'nucleo:testar-no-chat' && e.data.question) {
        // ATOMICO: zera contexto do ranker pra query ser processada isolada
        try {
          var _rk = window.BobbyChat && window.BobbyChat.ranker;
          if (_rk) {
            if (_rk.memory) { _rk.memory.activeOrbit = null; _rk.memory.activeEntity = null; _rk.memory.lastFacet = null; }
            if (_rk.dialog && typeof _rk.dialog.setPending === 'function') { _rk.dialog.setPending(null); }
          }
        } catch (_err) {}
        closeModal();
        setTimeout(function () {
          var chatModal = document.getElementById('chatModal');
          if (chatModal && !chatModal.classList.contains('open')) {
            chatModal.classList.add('open');
            document.body.classList.add('modal-open');
          }
          setTimeout(function () {
            if (window.BobbyChat && typeof window.BobbyChat.ask === 'function') {
              try { window.BobbyChat.ask(e.data.question); } catch (err) {}
              setTimeout(pushRealData, 900);
              setTimeout(pushRealData, 2200);
            }
          }, 500);
        }, 600);
      }
    });


    window.addEventListener('message', function (e) {
      if (!e.data) return;
      if (e.data.type === 'nucleo:ask' && e.data.question) {
        closeModal();
        if (window.BobbyChat && typeof window.BobbyChat.ask === 'function') {
          try { window.BobbyChat.ask(e.data.question); } catch (err) {}
          setTimeout(pushRealData, 900);
          setTimeout(pushRealData, 2200);
        }
      }
    });
    function openModal() { modal.classList.add('open'); document.body.classList.add('modal-open'); if (ready) setupIframe(); }
    function closeModal() { modal.classList.remove('open'); document.body.classList.remove('modal-open'); }
    badge.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
    badge.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); } });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();