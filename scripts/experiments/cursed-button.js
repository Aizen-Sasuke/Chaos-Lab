/**
 * CHAOS LAB — Experiment 2: Cursed Button
 * A button that actively avoids being clicked
 */

import { Experiment } from '../core/Experiment.js';
import { Particle, ParticleEmitter } from '../core/ParticleSystem.js';
import { random, randomChoice, clamp, lerp, hslToCss, getRandomAccent, distance } from '../core/utils.js';

const TAUNTS = [
  "Nice try.",
  "Too slow!",
  "Catch me if you can.",
  "Not today.",
  "You'll never click me.",
  "Running away...",
  "Is that all you got?",
  "Missed me!",
  "Better luck next time.",
  "I'm just a button, not a target.",
  "Click? I don't know her.",
  "Error 404: Click not found",
  "Access denied.",
  "Permission denied.",
  "Try again in 2.3 seconds.",
  "The button is a lie.",
  "You call that a click?",
  "My lawyer will contact you.",
  "That tickles.",
  "Oops, my bad.",
  "Not in this lifetime.",
  "Keep dreaming.",
  "Almost... not really.",
  "404: Motivation not found",
  "Ctrl+Alt+Defeat",
  "Skill issue.",
  "Git gud.",
  "Imagine clicking me.",
  "L + ratio.",
  "Touch grass.",
  "The button has left the chat."
];

const ESCAPE_TAUNTS = [
  "HAHAHA!",
  "WEEEE!",
  "YEET!",
  "ZOOM!",
  "BYE!",
  "SEE YA!",
  "TOO EASY!",
  "NOT TODAY SATAN!",
  "SPEED RUN!",
  "GOTTEM!"
];

const PARTICLE_COLORS = ['#ff2a6d', '#ffd700', '#00ffc8', '#ff6d00', '#7c4dff'];

export class CursedButtonExperiment extends Experiment {
  constructor(options = {}) {
    super({ id: 'cursed-button', name: 'Cursed Button', ...options });

    this.button = null;
    this.buttonRect = { x: 0, y: 0, width: 200, height: 60 };
    this.targetRect = { ...this.buttonRect };
    this.velocity = { x: 0, y: 0 };

    this.clicks = 0;
    this.escapes = 0;
    this.hovers = 0;
    this.lastEscapeTime = 0;

    this.particleEmitter = null;
    this.burstParticles = [];
    this.tauntElement = null;
    this.tauntTimer = 0;
    this.currentTaunt = '';

    this.isEscaping = false;
    this.escapeCooldown = 0;
    this.minEscapeDistance = 150;
    this.escapeForce = 0.8;
    this.springStiffness = 0.15;
    this.springDamping = 0.85;

    this.bounds = { left: 50, top: 50, right: 0, bottom: 0 };
  }

  async init(container) {
    await super.init(container);

    // Calculate bounds
    this.updateBounds();

    // Initial position - center of screen
    this.buttonRect.x = Math.max(this.bounds.left, (window.innerWidth - this.buttonRect.width) / 2);
    this.buttonRect.y = Math.max(this.bounds.top, (window.innerHeight - this.buttonRect.height) / 2);
    this.targetRect = { ...this.buttonRect };

    // Create button element
    this.createButton();

    // Create particle emitter for bursts
    this.particleEmitter = new ParticleEmitter({
      x: this.buttonRect.x + this.buttonRect.width / 2,
      y: this.buttonRect.y + this.buttonRect.height / 2,
      rate: 0,
      maxParticles: 200,
      particleOptions: {
        minSpeed: 100,
        maxSpeed: 400,
        minRadius: 3,
        maxRadius: 8,
        minLife: 0.5,
        maxLife: 1.5,
        fadeRate: 0.03,
        gravity: 200,
        drag: 0.95
      },
      emitFn: (emitter) => ({
        x: emitter.x,
        y: emitter.y,
        vx: random(-1, 1) * random(100, 400),
        vy: random(-1, 1) * random(100, 400) - 200,
        radius: random(3, 8),
        color: randomChoice(PARTICLE_COLORS),
        life: random(0.5, 1.5),
        fadeRate: 0.03,
        gravity: 200,
        drag: 0.95,
        shape: randomChoice(['circle', 'square', 'triangle', 'star'])
      })
    });

    // Stats overlay
    this.showOverlay(this.createStatsOverlay());

    // Listen for resize
    this.resizeHandler = this.handleResize.bind(this);
    window.addEventListener('resize', this.resizeHandler);

    return this;
  }

  createButton() {
    this.button = document.createElement('button');
    this.button.className = 'cursed-btn';
    this.button.textContent = 'CLICK ME';
    this.button.setAttribute('aria-label', 'Cursed button - try to click it');

    // Style positioning
    Object.assign(this.button.style, {
      position: 'fixed',
      left: `${this.buttonRect.x}px`,
      top: `${this.buttonRect.y}px`,
      width: `${this.buttonRect.width}px`,
      height: `${this.buttonRect.height}px`,
      zIndex: 1000,
      pointerEvents: 'auto'
    });

    // Events
    this.button.addEventListener('click', this.handleClick.bind(this));
    this.button.addEventListener('mouseenter', this.handleHover.bind(this));
    this.button.addEventListener('touchstart', this.handleHover.bind(this), { passive: true });

    document.body.appendChild(this.button);

    // Create taunt element
    this.tauntElement = document.createElement('div');
    this.tauntElement.className = 'cursed-taunt';
    this.tauntElement.style.cssText = `
      position: fixed;
      left: ${this.buttonRect.x + this.buttonRect.width / 2}px;
      top: ${this.buttonRect.y - 40}px;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 1001;
      white-space: nowrap;
      transition: opacity 0.2s, transform 0.2s;
    `;
    document.body.appendChild(this.tauntElement);
  }

  createStatsOverlay() {
    const div = document.createElement('div');
    div.className = 'cursed-btn-wrapper';
    div.innerHTML = `
      <div class="cursed-stats">
        <span>Clicks: <span class="stat-value" id="cursed-clicks">0</span></span>
        <span>Escapes: <span class="stat-value" id="cursed-escapes">0</span></span>
        <span>Hovers: <span class="stat-value" id="cursed-hovers">0</span></span>
      </div>
      <p style="font-size: 0.75rem; color: var(--fg-muted); text-align: center; max-width: 300px;">
        Try to click the button. It <em>really</em> doesn't want to be clicked.
      </p>
    `;
    return div;
  }

  updateBounds() {
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    const padding = 50;
    this.bounds = {
      left: padding,
      top: 180,
      right: Math.max(300, w - padding),
      bottom: Math.max(300, h - padding)
    };
  }

  handleResize() {
    this.resize();
    this.updateBounds();
    this.clampButtonPosition();
  }

  handleClick(event) {
    event.preventDefault();
    event.stopPropagation();

    this.clicks++;
    this.updateStatsDisplay();

    // Burst particles
    this.burstParticles();

    // Show taunt
    this.showTaunt(randomChoice(TAUNTS));

    // Button visual feedback
    this.button.classList.add('clicked');
    setTimeout(() => this.button.classList.remove('clicked'), 100);

    // Trigger escape
    this.triggerEscape();

    this.emit('click', { clicks: this.clicks });
  }

  handleHover() {
    this.hovers++;
    this.updateStatsDisplay();

    // Trigger escape on hover too (but with cooldown)
    if (this.escapeCooldown <= 0) {
      this.triggerEscape();
    }
  }

  triggerEscape() {
    const now = performance.now();
    if (now - this.lastEscapeTime < 300) return; // Cooldown

    this.lastEscapeTime = now;
    this.escapes++;
    this.updateStatsDisplay();
    this.isEscaping = true;
    this.escapeCooldown = 500;

    // Calculate escape direction (away from mouse)
    const btnCenterX = this.buttonRect.x + this.buttonRect.width / 2;
    const btnCenterY = this.buttonRect.y + this.buttonRect.height / 2;

    // We need mouse position - approximate from button center for now
    // The actual escape will be calculated in update() using current mouse pos
    this.showTaunt(randomChoice(ESCAPE_TAUNTS), true);

    this.button.classList.add('escaped');
    setTimeout(() => this.button.classList.remove('escaped'), 2000);

    this.emit('escape', { escapes: this.escapes });
  }

  showTaunt(text, isEscape = false) {
    if (!this.tauntElement) return;

    this.tauntElement.textContent = text;
    this.tauntElement.classList.add('visible');
    this.currentTaunt = text;
    this.tauntTimer = isEscape ? 1.5 : 1;

    // Position near button
    this.updateTauntPosition();
  }

  updateTauntPosition() {
    if (!this.tauntElement || !this.button) return;
    const x = this.buttonRect.x + this.buttonRect.width / 2;
    const y = this.buttonRect.y - 30;
    this.tauntElement.style.left = `${x}px`;
    this.tauntElement.style.top = `${y}px`;
  }

  updateStatsDisplay() {
    const clicksEl = document.getElementById('cursed-clicks');
    const escapesEl = document.getElementById('cursed-escapes');
    const hoversEl = document.getElementById('cursed-hovers');
    if (clicksEl) clicksEl.textContent = this.clicks;
    if (escapesEl) escapesEl.textContent = this.escapes;
    if (hoversEl) hoversEl.textContent = this.hovers;
  }

  burstParticles() {
    const cx = this.buttonRect.x + this.buttonRect.width / 2;
    const cy = this.buttonRect.y + this.buttonRect.height / 2;
    this.particleEmitter.setPosition(cx, cy);
    this.particleEmitter.burst(30);
  }

  update(dt) {
    if (this.paused) return;

    // Update escape cooldown
    if (this.escapeCooldown > 0) {
      this.escapeCooldown -= dt * 1000;
    }

    // Update taunt timer
    if (this.tauntTimer > 0) {
      this.tauntTimer -= dt;
      if (this.tauntTimer <= 0) {
        this.tauntElement?.classList.remove('visible');
      }
    }

    // Get mouse position relative to viewport
    // We'll track mouse via pointer events on the canvas
    const mouseX = this.mouseX || this.width / 2;
    const mouseY = this.mouseY || this.height / 2;

    // Calculate escape behavior
    if (this.isEscaping || this.shouldEscape(mouseX, mouseY)) {
      this.calculateEscapeTarget(mouseX, mouseY);
    } else {
      // Spring back to center when not escaping
      const centerX = (this.bounds.right + this.bounds.left - this.buttonRect.width) / 2;
      const centerY = (this.bounds.bottom + this.bounds.top - this.buttonRect.height) / 2;
      this.targetRect.x = centerX;
      this.targetRect.y = centerY;
    }

    // Spring physics for smooth movement
    this.velocity.x = (this.velocity.x + (this.targetRect.x - this.buttonRect.x) * this.springStiffness) * this.springDamping;
    this.velocity.y = (this.velocity.y + (this.targetRect.y - this.buttonRect.y) * this.springStiffness) * this.springDamping;

    this.buttonRect.x += this.velocity.x * dt * 60;
    this.buttonRect.y += this.velocity.y * dt * 60;

    // Clamp to bounds
    this.clampButtonPosition();

    // Update DOM position
    if (this.button) {
      this.button.style.left = `${this.buttonRect.x}px`;
      this.button.style.top = `${this.buttonRect.y}px`;
    }

    this.updateTauntPosition();

    // Update particles
    this.particleEmitter.update(dt, { left: 0, top: 0, right: this.width, bottom: this.height });
    this.burstParticles = this.burstParticles.filter(p => p.update(dt, { left: 0, top: 0, right: this.width, bottom: this.height }));

    // Reset escaping state
    if (this.isEscaping && Math.hypot(this.velocity.x, this.velocity.y) < 5) {
      this.isEscaping = false;
    }

    this.updateStatsDisplay();
  }

  shouldEscape(mouseX, mouseY) {
    const btnCenterX = this.buttonRect.x + this.buttonRect.width / 2;
    const btnCenterY = this.buttonRect.y + this.buttonRect.height / 2;
    const dist = distance(mouseX, mouseY, btnCenterX, btnCenterY);
    return dist < this.minEscapeDistance && !this.isEscaping;
  }

  calculateEscapeTarget(mouseX, mouseY) {
    const btnCenterX = this.buttonRect.x + this.buttonRect.width / 2;
    const btnCenterY = this.buttonRect.y + this.buttonRect.height / 2;

    // Direction away from mouse
    const dx = btnCenterX - mouseX;
    const dy = btnCenterY - mouseY;
    const dist = Math.hypot(dx, dy) || 1;

    const escapeDist = this.minEscapeDistance + random(50, 150);
    const force = this.escapeForce;

    let targetX = btnCenterX + (dx / dist) * escapeDist * force;
    let targetY = btnCenterY + (dy / dist) * escapeDist * force;

    // Add some randomness
    targetX += random(-50, 50);
    targetY += random(-50, 50);

    // Clamp to bounds
    targetX = clamp(targetX, this.bounds.left, this.bounds.right - this.buttonRect.width);
    targetY = clamp(targetY, this.bounds.top, this.bounds.bottom - this.buttonRect.height);

    this.targetRect.x = targetX;
    this.targetRect.y = targetY;
    this.isEscaping = true;
  }

  clampButtonPosition() {
    this.buttonRect.x = clamp(this.buttonRect.x, this.bounds.left, this.bounds.right - this.buttonRect.width);
    this.buttonRect.y = clamp(this.buttonRect.y, this.bounds.top, this.bounds.bottom - this.buttonRect.height);

    this.targetRect.x = clamp(this.targetRect.x, this.bounds.left, this.bounds.right - this.buttonRect.width);
    this.targetRect.y = clamp(this.targetRect.y, this.bounds.top, this.bounds.bottom - this.buttonRect.height);
  }

  handlePointer(event) {
    super.handlePointer(event);
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;
  }

  render() {
    const ctx = this.ctx;

    // Clear
    ctx.clearRect(0, 0, this.width, this.height);

    // Draw subtle grid
    this.drawGrid(ctx);

    // Draw particle emitter particles
    this.particleEmitter.draw(ctx);

    // Draw burst particles
    this.burstParticles.forEach(p => p.draw(ctx));
  }

  drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 42, 109, 0.03)';
    ctx.lineWidth = 1;
    const spacing = 40;

    for (let x = 0; x <= this.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y <= this.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  destroy() {
    if (this.button && this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
    }
    if (this.tauntElement && this.tauntElement.parentNode) {
      this.tauntElement.parentNode.removeChild(this.tauntElement);
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    super.destroy();
  }
}