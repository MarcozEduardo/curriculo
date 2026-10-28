/**
 * Intro Overlay Controller - Efeito de Revelação Gradual da Rede Neural & Desfoque
 */
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('neuralCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const captureArea = document.getElementById('captureArea');
  const overlay = document.getElementById('introOverlay');
  const typedNameEl = document.getElementById('typedName');
  const loaderBar = document.getElementById('loaderBar');
  const loaderText = document.getElementById('loaderText');

  // Aplica o desfoque inicial no currículo
  if (captureArea) captureArea.classList.add('intro-blur');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const particles = [];
  const particleCount = Math.min(50, Math.floor((window.innerWidth * window.innerHeight) / 28000));
  const maxDistance = 110;

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.7;
      this.vy = (Math.random() - 0.5) * 0.7;
      this.size = Math.random() * 2 + 1.2;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 122, 46, 0.45)';
      ctx.fill();
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  let isRunning = true;
  function animate() {
    if (!isRunning) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();

      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDistance) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const alpha = (1 - dist / maxDistance) * 0.18;
          ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();

  // Digitação
  const nameText = "Marcos Eduardo";
  let charIndex = 0;
  function typeName() {
    if (typedNameEl && charIndex < nameText.length) {
      typedNameEl.textContent += nameText.charAt(charIndex);
      charIndex++;
      setTimeout(typeName, 32);
    }
  }
  setTimeout(typeName, 120);

  // Logs de carregamento
  const logs = [
    "Carregando informações...",
    "Inicializando RAG Engine...",
    "Mapeando projetos e jogos...",
    "Montando interface...",
    "Pronto!"
  ];
  let logIndex = 0;
  function updateLogs() {
    if (loaderText && logIndex < logs.length) {
      loaderText.textContent = logs[logIndex];
      logIndex++;
      setTimeout(updateLogs, 500);
    }
  }
  updateLogs();

  // Revelação Gradual e Desfoque (3 Segundos)
  let progress = 0;
  const totalTime = 1700;
  const stepTime = 30;
  const stepInc = 100 / (totalTime / stepTime);

  const timer = setInterval(() => {
    progress += stepInc;
    if (progress >= 100) {
      progress = 100;
      clearInterval(timer);

      // Remove o desfoque e inicia o fade (removeProperty evita stacking context fantasma)
      if (captureArea) {
        captureArea.style.removeProperty('filter');
        captureArea.style.removeProperty('opacity');
      }

      setTimeout(() => {
        if (overlay) overlay.classList.add('fade-out');
        if (canvas) canvas.classList.add('fade-out');

        setTimeout(() => {
          isRunning = false;
          if (overlay) overlay.remove();
          if (canvas) canvas.remove();
          if (captureArea) captureArea.classList.remove('intro-blur');
        }, 800);
      }, 200);
    } else {
      // Transição progressiva de desfoque durante o loading
      const currentBlur = Math.max(0, 15 * (1 - (progress / 100)));
      const currentOpacity = Math.min(1, 0.03 + (0.97 * (progress / 100)));
      if (captureArea) {
        captureArea.style.filter = `blur(${currentBlur.toFixed(1)}px)`;
        captureArea.style.opacity = currentOpacity.toFixed(2);
      }
    }
    if (loaderBar) loaderBar.style.width = `${progress}%`;
  }, stepTime);
});
