/**
 * CHAOS LAB — Experiment 3: Name Particle Generator
 * Type your name, watch it form and explode into particles
 */

import { Experiment } from '../core/Experiment.js';
import { Particle, TextParticleizer, ForceField } from '../core/ParticleSystem.js';
import { random, randomChoice, clamp, lerp } from '../core/utils.js';

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
    // The mouse field should only exist once the pointer has actually entered
    // the experiment. Otherwise a default (0, 0) position quietly drags the
    // forming name into the corner.
    this.pointerActive = false;

    this.fontSize = 200;
    this.minFontSize = 24;
    this.maxFontSize = 360;
    // The name is centred slightly above the canvas middle so the bottom input
    // dock never sits on top of it.
    this.textCenterY = 0.44;
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

    // Text measured before the webfont loads would use the fallback face and
    // produce the wrong glyph shape. Wait for it, but never hang the init.
    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
    }

    // Sync the font to the canvas-derived size (the init-time resize() ran before this existed)
    this.applyFont(this.targetText || 'CHAOS LAB');

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
      <div class="name-input-row">
        <input type="text" class="name-input" id="name-input" placeholder="Enter your name" maxlength="20" spellcheck="false" autocomplete="off" />
        <button id="btn-form" class="name-btn name-btn-form" type="button">✨ Form</button>
        <button id="btn-explode" class="name-btn name-btn-explode" type="button">💥 Explode</button>
        <button id="btn-clear" class="name-btn name-btn-clear" type="button" aria-label="Clear name">✕</button>
      </div>
      <p class="name-input-hint">Press <kbd>Enter</kbd> to form · <kbd>Space</kbd> to explode</p>
    `;

    this.showOverlay(wrapper);

    this.textInput = document.getElementById('name-input');

    this.textInput.addEventListener('input', (e) => {
      this.targetText = e.target.value.toUpperCase().slice(0, 20);
      // Keep the preview glyphs inside the canvas as the text grows.
      if (!this.currentText) this.applyFont(this.targetText);
    });

    this.textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.formName();
      } else if (e.key === ' ') {
        // Space is the global pause key, but while typing it belongs to the
        // input. Don't let it reach ExperimentManager...
        e.stopPropagation();

        // ...and use it to detonate an already formed name.
        if (this.nameParticles.length > 0 && !this.isExploding) {
          e.preventDefault();
          this.explodeName();
        }
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
      // Return focus so Space keeps meaning "explode the name"
      this.textInput?.focus();
    });

    explodeBtn?.addEventListener('click', () => {
      this.explodeName();
      this.textInput?.focus();
    });

    clearBtn?.addEventListener('click', () => {
      this.clearName();
      this.textInput?.focus();
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

  /**
   * Largest font size that keeps the text inside ~85% of the canvas width and
   * well clear of the bottom input dock.
   */
  getFittedFontSize(text) {
    if (!this.textParticleizer || !text) return this.fontSize;

    const referenceSize = 100;
    this.textParticleizer.setFont(`bold ${referenceSize}px Space Grotesk`);
    const bounds = this.textParticleizer.getBounds(text);

    const maxWidth = this.width * 0.85;
    const maxHeight = this.height * 0.44;
    const byWidth = referenceSize * (maxWidth / Math.max(1, bounds.width));
    const byHeight = referenceSize * (maxHeight / Math.max(1, bounds.height));

    return clamp(Math.round(Math.min(byWidth, byHeight)), this.minFontSize, this.maxFontSize);
  }

  applyFont(text) {
    if (!this.textParticleizer) return;
    this.fontSize = this.getFittedFontSize(text);
    this.textParticleizer.setFont(`bold ${this.fontSize}px Space Grotesk`);
  }

  formName() {
    if (!this.targetText) return;

    this.currentText = this.targetText;
    this.isForming = true;
    this.formProgress = 0;
    this.isExploding = false;

    // Generate target positions from text, fitted to the current canvas.
    this.applyFont(this.currentText);
    this.textParticleizer.setText(this.currentText);
    const bounds = this.textParticleizer.getBounds();
    const particleData = this.textParticleizer.generate();
    const offsetX = (this.width - bounds.width) / 2;
    const offsetY = this.height * this.textCenterY - bounds.height / 2;

    // Spawn just around the name so the letters assemble quickly. Spawning
    // across the full canvas (with high velocities) made the "formed" name
    // look like a loose cloud for several seconds.
    const spawnX = this.width * 0.18;
    const spawnY = this.height * 0.18;

    this.nameParticles = particleData.map((data) => new Particle({
      x: this.width / 2 + random(-spawnX, spawnX),
      y: this.height * this.textCenterY + random(-spawnY, spawnY),
      vx: random(-8, 8),
      vy: random(-8, 8),
      radius: data.radius,
      color: data.color,
      targetX: data.targetX + offsetX,
      targetY: data.targetY + offsetY,
      // A formed name is the end state of the experiment: it must not expire.
      life: Infinity,
      maxLife: Infinity,
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
    if (this.textInput) this.textInput.value = '';
    this.isForming = false;
    this.isExploding = false;
    this.nameParticles = [];
    this.explosionParticles = [];
    this.showToast('Cleared', 'info');
  }

  handlePointer(event) {
    super.handlePointer(event);
    // HUD controls also produce window-level pointerup events; don't drag the
    // force field to a button when the user clicks it.
    if (event.type === 'pointerup') return;
    if (event.type === 'pointerleave' || event.type === 'pointercancel') {
      this.pointerActive = false;
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;
    this.forceField.setPosition(this.mouseX, this.mouseY);
    this.pointerActive = true;
  }

  handleKeyboard(event) {
    super.handleKeyboard(event);

    // Space / pause is owned by ExperimentManager. Here Escape clears the
    // name, but not while the user is typing in the input (Escape there
    // should just behave like a normal text-field escape).
    if (event.key === 'Escape' && event.target !== this.textInput) {
      this.clearName();
    }
  }

  getParticleCount() {
    return this.backgroundParticles.length + this.nameParticles.length + this.explosionParticles.length;
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

      // Mouse attraction only after the pointer has entered the experiment.
      if (this.pointerActive) this.forceField.applyTo(p, dt);

      // Jitter only while the name is assembling. Once formed, the letters
      // should sit still instead of boiling into a wide cloud.
      const jitter = 0.5 * (1 - this.formProgress);
      if (jitter > 0) {
        p.vx += (Math.random() - 0.5) * jitter * dt * 60;
        p.vy += (Math.random() - 0.5) * jitter * dt * 60;
      }

      p.update(dt, { left: -100, top: -100, right: this.width + 100, bottom: this.height + 100 });
    });

    // Update explosion particles
    this.explosionParticles.forEach(p => {
      if (!p.active) return;

      // Mouse repulsion during explosion
      const dx = p.x - this.mouseX;
      const dy = p.y - this.mouseY;
      const dist = Math.hypot(dx, dy);
      if (this.pointerActive && dist < 200 && dist > 0) {
        const safeDist = Math.max(dist, 8);
        const force = 3000 / (safeDist * safeDist);
        p.vx += (dx / dist) * force * dt * 60;
        p.vy += (dy / dist) * force * dt * 60;
      }

      p.update(dt, { left: -200, top: -200, right: this.width + 200, bottom: this.height + 200 });
    });

    // Clean up dead explosion particles
    this.explosionParticles = this.explosionParticles.filter(p => p.active);

    // Update background particles
    this.updateBackgroundParticles(dt);
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
      if (this.pointerActive && dist < 150 && dist > 0) {
        const safeDist = Math.max(dist, 8);
        const force = 1000 / (safeDist * safeDist);
        p.vx += (dx / dist) * force * dt * 60;
        p.vy += (dy / dist) * force * dt * 60;
      }

      // Wrap around
      if (p.x < -10) p.x = this.width + 10;
      if (p.x > this.width + 10) p.x = -10;
      if (p.y < -10) p.y = this.height + 10;
      if (p.y > this.height + 10) p.y = -10;

      // Drift
      const drift = Math.pow(0.999, dt * 60);
      p.vx *= drift;
      p.vy *= drift;
      p.vx += (Math.random() - 0.5) * 0.5;
      p.vy += (Math.random() - 0.5) * 0.5;
    });
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
    const centerY = this.height * this.textCenterY;
    ctx.font = `bold ${this.fontSize}px Space Grotesk`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const gradient = ctx.createLinearGradient(0, centerY - this.fontSize / 2, 0, centerY + this.fontSize / 2);
    gradient.addColorStop(0, '#00ffc8');
    gradient.addColorStop(0.5, '#ffd700');
    gradient.addColorStop(1, '#ff2a6d');

    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.3 + Math.sin(performance.now() * 0.003) * 0.2;

    const maxWidth = this.width * 0.85;
    ctx.fillText(this.targetText, this.width / 2, centerY, maxWidth);

    // Glow
    ctx.shadowColor = '#00ffc8';
    ctx.shadowBlur = 30;
    ctx.globalAlpha = 0.15;
    ctx.fillText(this.targetText, this.width / 2, centerY, maxWidth);

    ctx.restore();
  }

  drawFormationProgress(ctx) {
    const barWidth = Math.min(200, this.width * 0.5);
    const barHeight = 4;
    const x = (this.width - barWidth) / 2;
    // Sit just below the name, but never under the bottom input dock.
    const y = Math.min(
      this.height * 0.74,
      this.height * this.textCenterY + this.fontSize * 0.62 + 20
    );

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

    // The particleizer is created after super.init() runs, so it may not exist yet
    if (!this.textParticleizer) return;

    // Re-fit the font to the new canvas size.
    this.applyFont(this.currentText || this.targetText || 'CHAOS LAB');

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