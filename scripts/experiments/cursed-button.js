/**
 * CHAOS LAB — Experiment 2: Cursed Button
 * A button that actively avoids being clicked
 */

import { Experiment } from '../core/Experiment.js';
import { ParticleEmitter } from '../core/ParticleSystem.js';
import { random, randomChoice, clamp, distance } from '../core/utils.js';

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
    this.tauntElement = null;
    this.tauntTimer = 0;
    this.currentTaunt = '';

    this.isEscaping = false;
    this.escapeCooldown = 0;
    this.minEscapeDistance = 110;
    this.escapeForce = 0.8;
    this.springStiffness = 0.15;
    this.springDamping = 0.85;

    this.bounds = { left: 0, top: 0, right: 0, bottom: 0 };

    // Viewport coordinates: the button is position: fixed and sits above the
    // canvas, so canvas-local pointer coordinates can never be right.
    this.mouseX = null;
    this.mouseY = null;
    this.mouseMoveHandler = this.handleMouseMove.bind(this);
  }

  async init(container) {
    await super.init(container);

    // Keep the button inside the experiment area, not the whole window
    this.updateBounds();

    // Initial position - centre of the experiment
    this.buttonRect.x = this.bounds.left + (this.bounds.right - this.bounds.left - this.buttonRect.width) / 2;
    this.buttonRect.y = this.bounds.top + (this.bounds.bottom - this.bounds.top - this.buttonRect.height) / 2;
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

    // Track the pointer globally: once the cursor is over the <button>, the
    // canvas stops receiving pointermove events.
    window.addEventListener('mousemove', this.mouseMoveHandler, { passive: true });
    window.addEventListener('touchmove', this.mouseMoveHandler, { passive: true });

    return this;
  }

  handleMouseMove(event) {
    const touch = event.touches?.[0];
    this.mouseX = touch ? touch.clientX : event.clientX;
    this.mouseY = touch ? touch.clientY : event.clientY;
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
      zIndex: 40,
      pointerEvents: 'auto'
    });

    // Events
    this.button.addEventListener('click', this.handleClick.bind(this));
    this.button.addEventListener('mouseenter', this.handleHover.bind(this));
    // A tap should register as a click before the button decides to dodge,
    // so touch only records the attempt here.
    this.button.addEventListener('touchstart', () => {
      this.hovers++;
      this.updateStatsDisplay();
    }, { passive: true });

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
      z-index: 41;
      white-space: nowrap;
      transition: opacity 0.2s, transform 0.2s;
    `;
    document.body.appendChild(this.tauntElement);
  }

  createStatsOverlay() {
    const div = document.createElement('div');
    div.className = 'cursed-hud';
    div.innerHTML = `
      <div class="cursed-stats">
        <span>Clicks: <span class="stat-value" id="cursed-clicks">0</span></span>
        <span>Escapes: <span class="stat-value" id="cursed-escapes">0</span></span>
        <span>Hovers: <span class="stat-value" id="cursed-hovers">0</span></span>
      </div>
      <p class="cursed-hint">Try to click the button. It <em>really</em> doesn't want to be clicked.</p>
    `;
    return div;
  }

  updateBounds() {
    const rect = this.canvas?.getBoundingClientRect();
    const padding = 24;

    // Fall back to the window only if the canvas isn't laid out yet
    const left = rect ? rect.left : 0;
    const top = rect ? rect.top : 0;
    const right = rect ? rect.right : window.innerWidth;
    const bottom = rect ? rect.bottom : window.innerHeight;

    this.bounds = {
      left: left + padding,
      top: top + padding,
      right: Math.max(left + padding + this.buttonRect.width, right - padding),
      bottom: Math.max(top + padding + this.buttonRect.height, bottom - padding)
    };
  }

  handleResize() {
    super.handleResize();
    this.updateBounds();
    this.clampButtonPosition();
  }

  handleClick(event) {
    event.preventDefault();
    event.stopPropagation();

    this.clicks++;
    this.updateStatsDisplay();

    // Burst particles
    this.burstParticlesAtButton();

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
    // Give the button time to actually land and rest before it reacts again.
    this.escapeCooldown = 700;

    // Pick the landing spot now: update() holds this target during the
    // cooldown, so the hop starts immediately instead of waiting 700ms.
    const fallbackX = this.buttonRect.x + this.buttonRect.width / 2;
    const fallbackY = this.buttonRect.y + this.buttonRect.height / 2;
    this.calculateEscapeTarget(
      this.mouseX !== null ? this.mouseX : fallbackX,
      this.mouseY !== null ? this.mouseY : fallbackY
    );

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
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect) return;

    // Keep the taunt inside the experiment instead of letting it hang off an
    // edge when the button is near a corner.
    const width = this.tauntElement.offsetWidth || 160;
    const half = Math.min(width / 2, rect.width / 2);
    const x = clamp(
      this.buttonRect.x + this.buttonRect.width / 2,
      rect.left + half + 8,
      rect.right - half - 8
    );

    let y = this.buttonRect.y - 34;
    if (y < rect.top + 8) {
      y = this.buttonRect.y + this.buttonRect.height + 10;
    }
    y = clamp(y, rect.top + 8, Math.max(rect.top + 8, rect.bottom - 28));

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

  burstParticlesAtButton() {
    if (!this.particleEmitter) return;
    const cx = this.buttonRect.x + this.buttonRect.width / 2;
    const cy = this.buttonRect.y + this.buttonRect.height / 2;
    const rect = this.canvas.getBoundingClientRect();
    // The emitter draws on the canvas, so convert viewport -> canvas coords
    this.particleEmitter.setPosition(cx - rect.left, cy - rect.top);
    this.particleEmitter.burst(30);
  }

  update(dt) {
    if (this.paused) return;

    // Update escape cooldown
    if (this.escapeCooldown > 0) {
      this.escapeCooldown = Math.max(0, this.escapeCooldown - dt * 1000);
    }

    // Update taunt timer
    if (this.tauntTimer > 0) {
      this.tauntTimer -= dt;
      if (this.tauntTimer <= 0) {
        this.tauntElement?.classList.remove('visible');
      }
    }

    // Calculate escape behavior. While cooling down, keep the current target
    // so the hop can finish and the button becomes clickable for a moment.
    // Nothing to flee from until the pointer has actually moved (mouseX/mouseY
    // are viewport coordinates).
    const canReact = this.escapeCooldown <= 0;
    if (!canReact) {
      // Hold this target.
    } else if (this.mouseX !== null && this.mouseY !== null &&
        this.shouldEscape(this.mouseX, this.mouseY)) {
      // Approaching the button counts as an escape attempt, with the same
      // cooldown so it can actually be caught between hops.
      this.triggerEscape();
    } else {
      // Spring back to center when not escaping
      const centerX = (this.bounds.right + this.bounds.left - this.buttonRect.width) / 2;
      const centerY = (this.bounds.bottom + this.bounds.top - this.buttonRect.height) / 2;
      this.targetRect.x = centerX;
      this.targetRect.y = centerY;
    }

    // Spring physics for smooth movement. The constants are tuned for 60fps,
    // so convert them to per-second factors to stay consistent on other
    // refresh rates.
    const stiffness = 1 - Math.pow(1 - this.springStiffness, dt * 60);
    const damping = Math.pow(this.springDamping, dt * 60);

    this.velocity.x = (this.velocity.x + (this.targetRect.x - this.buttonRect.x) * stiffness) * damping;
    this.velocity.y = (this.velocity.y + (this.targetRect.y - this.buttonRect.y) * stiffness) * damping;

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

    // Reset escaping state
    if (this.isEscaping && Math.hypot(this.velocity.x, this.velocity.y) < 5) {
      this.isEscaping = false;
    }
  }

  getParticleCount() {
    return this.particleEmitter?.getCount() || 0;
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
    let dx = btnCenterX - mouseX;
    let dy = btnCenterY - mouseY;
    let dist = Math.hypot(dx, dy);

    // If the pointer is exactly on the button (e.g. a programmatic click),
    // pick a random direction instead of dividing by zero.
    if (dist < 1) {
      const angle = random(0, Math.PI * 2);
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      dist = 1;
    }

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

  render() {
    const ctx = this.ctx;

    // Clear
    ctx.clearRect(0, 0, this.width, this.height);

    // Draw subtle grid
    this.drawGrid(ctx);

    // Draw particle emitter particles
    this.particleEmitter.draw(ctx);
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
    window.removeEventListener('mousemove', this.mouseMoveHandler);
    window.removeEventListener('touchmove', this.mouseMoveHandler);
    if (this.particleEmitter) {
      this.particleEmitter.particles.length = 0;
      this.particleEmitter.active = false;
    }

    if (this.button && this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
    }
    if (this.tauntElement && this.tauntElement.parentNode) {
      this.tauntElement.parentNode.removeChild(this.tauntElement);
    }
    super.destroy();
  }
}