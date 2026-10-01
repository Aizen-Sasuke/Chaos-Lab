/**
 * CHAOS LAB — Experiment 3: Name Particle Generator
 * Type your name, watch it form and explode into particles
 */

import { Experiment } from '../core/Experiment.js';
import { Particle, ParticleEmitter, TextParticleizer, ForceField } from '../core/ParticleSystem.js';
import { random, randomChoice, clamp, lerp, distance, hslToCss, getRandomAccent } from '../core/utils.js';

const PARTICLE_COLORS = [
  '#00ffc8', // cyan
  '#ff2a6d', // pink
  '#ffd700', // gold
  '#7c4dff', // purple
  '#00e676', // green
  '#ff6d00', // orange
];

const BACKGROUND_PARTICLES = 200;

export class NameParticlesExperiment extends Experiment {
  constructor(options = {}) {
    super({ id: 'name-particles', name: 'Name Particles', ...options });

    this.textInput = null;
    this.textParticleizer = null;
    this.nameParticles = [];      // Particles forming the name
    this.explosionParticles = []; // Particles from explosion
    this.backgroundParticles = [];

    this.currentText = '';
    this.targetText = '';
    this.isForming = false;
    this.isExploding = false;
    this.formProgress = 0;
    this.explodeProgress = 0;
    this.lastExplosionTime = 0;

    this.forceField = null;
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;

    this.fontSize = 200;
    this.minFontSize = 80;
    this.maxFontSize = 400;
  }

  async init(container) {
    await super.init(container);

    // Create text particleizer
    this.textParticleizer = new TextParticleizer({
      font: `bold ${this.fontSize}px Space Grotesk`,
      particleSize: 4,
      gap: 1,
      colors: PARTICLE_COLORS
    });

    // Create input overlay
    this.createInputOverlay();

    // Create force field for mouse interaction
    this.forceField = new ForceField({
      x: this.width / 2,
      y: this.height / 2,
      strength: 5000,
      radius: 300,
      type: 'attract'
    });

    // Create background ambient particles
    this.createBackgroundParticles();

    // Handle keyboard for input focus
    this.canvas.addEventListener('click', () => this.textInput?.focus());
    this.canvas.addEventListener('touchstart', () => this.textInput?.focus());

    return this;
  }

  createInputOverlay() {
    const wrapper = document.createElement('div');
    wrapper.className = 'name-input-wrapper';
    wrapper.innerHTML = `
      <input type="text" class="name-input" id="name-input" placeholder="Enter your name" maxlength="20" spellcheck="false" autocomplete="off" />
      <div class="name-actions" style="display: flex; gap: 8px; width: 100%; justify-content: center; flex-wrap: wrap;">
        <button id="btn-form" class="switcher-btn" style="padding: 8px 16px; min-width: auto; background: var(--accent); color: var(--bg); font-weight: bold;">✨ Form</button>
        <button id="btn-explode" class="switcher-btn" style="padding: 8px 16px; min-width: auto; background: var(--accent-2); color: #fff; font-weight: bold;">💥 Explode</button>
        <button id="btn-clear" class="switcher-btn" style="padding: 8px 16px; min-width: auto; background: var(--bg-panel); border: 1px solid var(--border); color: var(--fg-muted);">❌ Clear</button>
      </div>
      <p class="name-input-hint">Type name and click <kbd>Form</kbd> or press <kbd>Enter</kbd></p>
    `;

    this.showOverlay(wrapper);

    this.textInput = document.getElementById('name-input');

    this.textInput.addEventListener('input', (e) => {
      this.targetText = e.target.value.toUpperCase().slice(0, 20);
    });

    this.textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.formName();
      } else if (e.key === ' ' && !this.targetText) {
        e.preventDefault();
        this.explodeName();
      } else if (e.key === 'Backspace' && !this.targetText && this.currentText) {
        this.clearName();
      }
    });

    const formBtn = document.getElementById('btn-form');
    const explodeBtn = document.getElementById('btn-explode');
    const clearBtn = document.getElementById('btn-clear');

    formBtn?.addEventListener('click', () => {
      if (!this.targetText && this.textInput?.value) {
        this.targetText = this.textInput.value.toUpperCase().slice(0, 20);
      }
      if (!this.targetText) {
        this.targetText = "CHAOS LAB";
        if (this.textInput) this.textInput.value = "CHAOS LAB";
      }
      this.formName();
    });

    explodeBtn?.addEventListener('click', () => {
      this.explodeName();
    });

    clearBtn?.addEventListener('click', () => {
      this.clearName();
    });

    // Focus input on init
    setTimeout(() => this.textInput?.focus(), 300);
  }

  createBackgroundParticles() {
    for (let i = 0; i < BACKGROUND_PARTICLES; i++) {
      this.backgroundParticles.push({
        x: random(0, this.width),
        y: random(0, this.height),
        vx: random(-10, 10),
        vy: random(-10, 10),
        radius: random(0.5, 2),
        color: randomChoice(PARTICLE_COLORS),
        alpha: random(0.1, 0.4),
        phase: random(0, Math.PI * 2),
        speed: random(0.2, 0.5)
      });
    }
  }

  formName() {
    if (!this.targetText) return;

    this.currentText = this.targetText;
    this.isForming = true;
    this.formProgress = 0;
    this.isExploding = false;

    // Generate target positions from text
    const particleData = this.textParticleizer.generate();
    this.nameParticles = particleData.map((data, i) => new Particle({
      x: this.width / 2 + random(-100, 100),
      y: this.height / 2 + random(-100, 100),
      vx: random(-50, 50),
      vy: random(-50, 50),
      radius: data.radius,
      color: data.color,
      targetX: data.targetX + (this.width - this.textParticleizer.getBounds().width) / 2,
      targetY: data.targetY + (this.height - this.textParticleizer.getBounds().height) / 2,
      life: 1,
      maxLife: 1,
      fadeRate: 0,
      drag: 0.92,
      shape: 'circle'
    }));

    this.showToast(`Forming "${this.currentText}"...`, 'success');
  }

  explodeName() {
    if (this.nameParticles.length === 0) return;

    this.isExploding = true;
    this.explodeProgress = 0;
    this.isForming = false;
    this.lastExplosionTime = performance.now();

    // Convert name particles to explosion particles
    this.nameParticles.forEach(p => {
      const angle = random(0, Math.PI * 2);
      const speed = random(200, 600);
      this.explosionParticles.push(new Particle({
        x: p.x,
        y: p.y,
        vx: Math.cos(angle) * speed + p.vx,
        vy: Math.sin(angle) * speed + p.vy,
        radius: p.radius * random(0.8, 1.5),
        color: p.color,
        life: random(1.5, 3),
        maxLife: random(1.5, 3),
        fadeRate: 0.015,
        drag: 0.96,
        gravity: 100,
        shape: randomChoice(['circle', 'square', 'triangle', 'star']),
        rotationSpeed: random(-0.2, 0.2)
      }));
    });

    this.nameParticles = [];
    this.showToast('BOOM! 💥', 'success');
  }

  clearName() {
    this.currentText = '';
    this.targetText = '';
    this.textInput.value = '';
    this.isForming = false;
    this.isExploding = false;
    this.nameParticles = [];
    this.explosionParticles = [];
    this.showToast('Cleared', 'info');
  }

  handlePointer(event) {
    super.handlePointer(event);
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;
    this.forceField.setPosition(this.mouseX, this.mouseY);
  }

  handleKeyboard(event) {
    super.handleKeyboard(event);

    if (event.key === ' ') {
      if (this.targetText && !this.currentText) {
        event.preventDefault();
        this.formName();
      } else if (this.currentText && !this.isExploding) {
        event.preventDefault();
        this.explodeName();
      }
    } else if (event.key === 'Escape') {
      this.clearName();
    }
  }

  update(dt) {
    if (this.paused) return;

    // Update forming progress
    if (this.isForming) {
      this.formProgress = Math.min(1, this.formProgress + dt * 2);
      if (this.formProgress >= 1) {
        this.isForming = false;
      }
    }

    // Update explosion progress
    if (this.isExploding) {
      this.explodeProgress = Math.min(1, this.explodeProgress + dt * 0.5);
      if (this.explodeProgress >= 1) {
        this.isExploding = false;
      }
    }

    // Update name particles (forming)
    this.nameParticles.forEach(p => {
      if (!p.active) return;

      // Spring to target position
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 1) {
        const force = 0.08 * this.formProgress;
        p.vx += (dx / dist) * force * dist * dt * 60;
        p.vy += (dy / dist) * force * dist * dt * 60;
      }

      // Mouse attraction
      this.forceField.applyTo(p, dt);

      // Subtle noise
      p.vx += (Math.random() - 0.5) * 10 * dt * 60;
      p.vy += (Math.random() - 0.5) * 10 * dt * 60;

      p.update(dt, { left: -100, top: -100, right: this.width + 100, bottom: this.height + 100 });
    });

    // Update explosion particles
    this.explosionParticles.forEach(p => {
      if (!p.active) return;

      // Mouse repulsion during explosion
      const dx = p.x - this.mouseX;
      const dy = p.y - this.mouseY;
      const dist = Math.hypot(dx, dy);
      if (dist < 200 && dist > 0) {
        const force = 3000 / (dist * dist);
        p.vx += (dx / dist) * force * dt * 60;
        p.vy += (dy / dist) * force * dt * 60;
      }

      p.update(dt, { left: -200, top: -200, right: this.width + 200, bottom: this.height + 200 });
    });

    // Clean up dead explosion particles
    this.explosionParticles = this.explosionParticles.filter(p => p.active);

    // Update background particles
    this.updateBackgroundParticles(dt);

    // Update stats
    this.updateStats();
  }

  updateBackgroundParticles(dt) {
    this.backgroundParticles.forEach(p => {
      p.phase += p.speed * dt;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;

      // Mouse interaction
      const dx = this.mouseX - p.x;
      const dy = this.mouseY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150 && dist > 0) {
        const force = 1000 / (dist * dist);
        p.vx += (dx / dist) * force * dt * 60;
        p.vy += (dy / dist) * force * dt * 60;
      }

      // Wrap around
      if (p.x < -10) p.x = this.width + 10;
      if (p.x > this.width + 10) p.x = -10;
      if (p.y < -10) p.y = this.height + 10;
      if (p.y > this.height + 10) p.y = -10;

      // Drift
      p.vx *= 0.999;
      p.vy *= 0.999;
      p.vx += (Math.random() - 0.5) * 0.5;
      p.vy += (Math.random() - 0.5) * 0.5;
    });
  }

  updateStats() {
    const count = this.nameParticles.length + this.explosionParticles.length + this.backgroundParticles.length;
    const statCount = document.getElementById('particle-count');
    if (statCount) {
      statCount.textContent = count;
    }
  }

  render() {
    const ctx = this.ctx;

    // Clear
    ctx.clearRect(0, 0, this.width, this.height);

    // Dark background panel
    ctx.fillStyle = '#11111a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw background particles
    this.drawBackgroundParticles(ctx);

    // Draw name particles (forming)
    this.nameParticles.forEach(p => {
      if (!p.active) return;

      ctx.save();
      ctx.globalAlpha = lerp(0.3, 1, this.formProgress);
      p.draw(ctx);
      ctx.restore();
    });

    // Draw explosion particles
    this.explosionParticles.forEach(p => p.draw(ctx));

    // Draw text preview if no particles yet
    if (!this.currentText && this.targetText && !this.isForming) {
      this.drawTextPreview(ctx);
    }

    // Draw formation progress indicator
    if (this.isForming) {
      this.drawFormationProgress(ctx);
    }
  }

  drawBackgroundParticles(ctx) {
    ctx.save();
    this.backgroundParticles.forEach(p => {
      ctx.globalAlpha = p.alpha * (0.5 + Math.sin(p.phase) * 0.3);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawTextPreview(ctx) {
    ctx.save();
    ctx.font = `bold ${this.fontSize}px Space Grotesk`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const gradient = ctx.createLinearGradient(0, this.height / 2 - this.fontSize / 2, 0, this.height / 2 + this.fontSize / 2);
    gradient.addColorStop(0, '#00ffc8');
    gradient.addColorStop(0.5, '#ffd700');
    gradient.addColorStop(1, '#ff2a6d');

    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.3 + Math.sin(performance.now() * 0.003) * 0.2;

    const maxWidth = this.width * 0.9;
    ctx.fillText(this.targetText, this.width / 2, this.height / 2, maxWidth);

    // Glow
    ctx.shadowColor = '#00ffc8';
    ctx.shadowBlur = 30;
    ctx.globalAlpha = 0.15;
    ctx.fillText(this.targetText, this.width / 2, this.height / 2, maxWidth);

    ctx.restore();
  }

  drawFormationProgress(ctx) {
    const barWidth = 200;
    const barHeight = 4;
    const x = (this.width - barWidth) / 2;
    const y = this.height / 2 + this.fontSize / 2 + 40;

    ctx.save();
    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Progress
    const gradient = ctx.createLinearGradient(x, y, x + barWidth, y);
    gradient.addColorStop(0, '#00ffc8');
    gradient.addColorStop(1, '#ffd700');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth * this.formProgress, barHeight);

    // Glow
    ctx.shadowColor = '#00ffc8';
    ctx.shadowBlur = 10;
    ctx.fillRect(x, y, barWidth * this.formProgress, barHeight);

    ctx.restore();
  }

  resize() {
    super.resize();

    // Update text particleizer font size based on canvas width
    const newFontSize = clamp(this.width * 0.15, this.minFontSize, this.maxFontSize);
    if (Math.abs(newFontSize - this.fontSize) > 10) {
      this.fontSize = newFontSize;
      this.textParticleizer.setFont(`bold ${this.fontSize}px Space Grotesk`);
    }

    // Recreate background particles for new size
    if (this.backgroundParticles.length !== BACKGROUND_PARTICLES) {
      this.backgroundParticles.length = 0;
      this.createBackgroundParticles();
    }

    // Re-form name if exists
    if (this.currentText && this.nameParticles.length > 0) {
      this.formName();
    }
  }

  destroy() {
    this.nameParticles.length = 0;
    this.explosionParticles.length = 0;
    this.backgroundParticles.length = 0;
    super.destroy();
  }
}