/**
 * CHAOS LAB — Experiment 1: Cursor Gravity
 * Particles orbit and react to cursor position
 */

import { Experiment } from '../core/Experiment.js';
import { Particle, ParticlePool, ForceField, SpatialGrid } from '../core/ParticleSystem.js';
import { random, randomChoice, clamp, hslToCss, prefersReducedMotion } from '../core/utils.js';

const COLORS = [
  '#00ffc8', // cyan
  '#7c4dff', // purple
  '#ffd700', // gold
  '#00e676', // green
  '#ff6d00', // orange
];

const PARTICLE_COUNT = 800;
const FORCE_RADIUS = 400;
const FORCE_SOFTENING = 70;
const ATTRACT_STRENGTH = 9000;
const REPEL_STRENGTH = 9000;
const VORTEX_STRENGTH = 34;
const HOLD_BOOST = 2.1;

const MODE_META = {
  attract: { label: 'Attract', hint: 'particles are pulled in and orbit the cursor' },
  repel: { label: 'Repel', hint: 'particles flee, leaving a clear hole' },
  vortex: { label: 'Vortex', hint: 'particles swirl around the cursor' }
};

export class CursorGravityExperiment extends Experiment {
  constructor(options = {}) {
    super({ id: 'cursor-gravity', name: 'Cursor Gravity', ...options });

    this.particles = [];
    this.pool = null;
    this.forceField = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mode = 'attract'; // attract, repel, vortex
    this.modeNames = ['attract', 'repel', 'vortex'];
    this.colorCycle = 0;
  }

  async init(container) {
    await super.init(container);

    // Create force field at center initially
    this.forceField = new ForceField({
      x: this.width / 2,
      y: this.height / 2,
      strength: ATTRACT_STRENGTH,
      radius: FORCE_RADIUS,
      softening: FORCE_SOFTENING,
      orbit: 0.35,
      inward: 1.2,
      maxSpeed: 520,
      type: 'attract'
    });

    // Start with the cursor at the centre instead of (0, 0), otherwise the
    // whole field pulls the particles into the top-left corner on load.
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;

    // Create particle pool
    const particleCount = prefersReducedMotion() ? Math.floor(PARTICLE_COUNT / 4) : PARTICLE_COUNT;
    this.pool = new ParticlePool(() => new Particle({
      radius: random(1.5, 4),
      color: randomChoice(COLORS),
      // Low drag keeps orbital velocity alive instead of turning every mode
      // into "particles stick to the cursor".
      drag: 0.985,
      gravity: 0,
      bounce: 0.8,
      friction: 0.99
    }), particleCount);

    // Initialize particles distributed across canvas
    const w = Math.max(1, this.width);
    const h = Math.max(1, this.height);
    for (let i = 0; i < particleCount; i++) {
      const p = this.pool.acquire({
        x: random(0, w),
        y: random(0, h),
        vx: random(-6, 6),
        vy: random(-6, 6),
        life: Infinity,
        maxLife: Infinity,
        fadeRate: 0
      });
      this.particles.push(p);
    }

    // Bind specific events
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.cycleMode(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    // Show the mode HUD, then sync it with the initial mode.
    this.showOverlay(this.createInfoOverlay());
    this.applyModeSettings();
    this.updateInfoOverlay();

    return this;
  }

  createInfoOverlay() {
    const wrap = document.createElement('div');
    wrap.className = 'gravity-hud';
    wrap.innerHTML = `
      <div class="gravity-mode-display">
        <span class="gravity-mode-kicker">MODE</span>
        <strong class="gravity-mode-name" id="gravity-mode-name">Attract</strong>
        <span class="gravity-mode-hint" id="gravity-mode-hint">${MODE_META.attract.hint}</span>
      </div>
      <div class="gravity-modes" role="group" aria-label="Force mode">
        <button type="button" class="gravity-chip" data-mode="attract" aria-pressed="true">Attract</button>
        <button type="button" class="gravity-chip" data-mode="repel" aria-pressed="false">Repel</button>
        <button type="button" class="gravity-chip" data-mode="vortex" aria-pressed="false">Vortex</button>
      </div>
      <p class="gravity-hint">
        Move the cursor · <strong>Hold</strong> to boost · <kbd>Scroll</kbd> / <kbd>Right-click</kbd> to switch
      </p>
    `;

    wrap.querySelectorAll('.gravity-chip').forEach(btn => {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
    });

    return wrap;
  }

  setMode(mode, { announce = true } = {}) {
    if (!this.modeNames.includes(mode)) return;
    this.mode = mode;
    this.applyModeSettings();
    this.updateInfoOverlay();
    if (announce) {
      this.showToast(`Mode: ${MODE_META[mode].label.toUpperCase()}`, 'info', 1200);
    }
  }

  applyModeSettings() {
    if (!this.forceField) return;

    this.forceField.type = this.mode;
    switch (this.mode) {
      case 'attract':
        this.forceField.strength = ATTRACT_STRENGTH;
        this.forceField.orbit = 0.35;
        this.forceField.inward = 2.2;
        this.forceField.maxSpeed = 520;
        break;
      case 'repel':
        this.forceField.strength = REPEL_STRENGTH;
        this.forceField.orbit = 0;
        this.forceField.inward = 0;
        this.forceField.maxSpeed = 560;
        break;
      case 'vortex':
        this.forceField.strength = VORTEX_STRENGTH;
        this.forceField.orbit = 0;
        this.forceField.inward = 1.2;
        this.forceField.maxSpeed = 560;
        break;
    }
  }

  cycleMode(direction = 1) {
    const idx = this.modeNames.indexOf(this.mode);
    const newIdx = (idx + direction + this.modeNames.length) % this.modeNames.length;
    this.setMode(this.modeNames[newIdx]);
  }

  updateInfoOverlay() {
    if (!this.hud) return;

    const meta = MODE_META[this.mode];
    const nameEl = this.hud.querySelector('#gravity-mode-name');
    const hintEl = this.hud.querySelector('#gravity-mode-hint');
    if (nameEl) nameEl.textContent = meta.label;
    if (hintEl) hintEl.textContent = meta.hint;

    this.hud.querySelectorAll('.gravity-chip').forEach(btn => {
      const active = btn.dataset.mode === this.mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  handlePointer(event) {
    super.handlePointer(event);

    // Release events can arrive from anywhere on the page (e.g. a HUD chip),
    // so only end the boost and leave the field where the cursor last was.
    if (event.type === 'pointerup' || event.type === 'pointercancel' || event.type === 'pointerleave') {
      this.mouseDown = false;
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;

    this.forceField.setPosition(this.mouseX, this.mouseY);
    this.canvas.style.setProperty('--mouse-x', `${this.mouseX}px`);
    this.canvas.style.setProperty('--mouse-y', `${this.mouseY}px`);

    if (event.type === 'pointerdown') {
      // Right click cycles mode; left click / touch holds the current mode.
      if (event.button === 2) {
        this.cycleMode();
      } else {
        this.mouseDown = true;
      }
    }
  }

  update(dt) {
    if (this.paused) return;

    // Update force field position to mouse
    this.forceField.setPosition(this.mouseX, this.mouseY);

    const now = performance.now();
    const reduced = prefersReducedMotion();

    // Apply forces to all particles
    this.particles.forEach(p => {
      if (!p.active) return;

      // Apply force field. Holding the pointer boosts whichever mode is
      // active instead of adding a second, unrelated force.
      this.forceField.applyTo(p, dt, this.mouseDown ? HOLD_BOOST : 1);

      // A whisper of noise keeps the motion organic. Anything larger drowns
      // out the mode forces and makes all three modes look like a random boil.
      if (!reduced) {
        const noise = Math.sin(p.x * 0.005 + now * 0.001) *
                     Math.cos(p.y * 0.005 + now * 0.0013);
        p.vx += noise * 0.05 * dt * 60;
        p.vy += noise * 0.05 * dt * 60;
      }

      // Update particle
      p.update(dt, { left: 0, top: 0, right: this.width, bottom: this.height });

      // Wrap around edges (toroidal space)
      if (p.x < -p.radius) p.x = this.width + p.radius;
      if (p.x > this.width + p.radius) p.x = -p.radius;
      if (p.y < -p.radius) p.y = this.height + p.radius;
      if (p.y > this.height + p.radius) p.y = -p.radius;
    });

    // Color cycling
    this.colorCycle += dt * 0.1;
  }

  getParticleCount() {
    return this.particles.reduce((count, p) => count + (p.active ? 1 : 0), 0);
  }

  render() {
    const ctx = this.ctx;

    // Clear
    ctx.clearRect(0, 0, this.width, this.height);

    // Subtle dark panel background
    ctx.fillStyle = '#11111a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw force field visualization
    this.drawForceField(ctx);

    // Draw particles
    this.particles.forEach(p => {
      if (!p.active) return;

      // Dynamic color based on velocity
      const speed = Math.hypot(p.vx, p.vy);
      const hue = (180 + speed * 0.5 + this.colorCycle * 50) % 360;
      const saturation = clamp(60 + speed * 0.3, 50, 90);
      const lightness = clamp(50 + speed * 0.2, 40, 70);

      ctx.save();
      ctx.globalAlpha = 0.8;

      // Cheap glow for fast particles: a translucent additive halo.
      // ctx.shadowBlur is far too expensive to set per particle.
      if (speed > 100) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = hslToCss(hue, saturation, lightness);
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.min(p.radius * 2.4, 10), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.globalCompositeOperation = 'source-over';
      }

      p.draw(ctx);
      ctx.restore();
    });

    // Draw connections between nearby particles (subtle)
    this.drawConnections(ctx);
  }

  drawForceField(ctx) {
    const { x, y, radius, type } = this.forceField;

    ctx.save();
    ctx.globalAlpha = 0.15;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    if (type === 'attract') {
      gradient.addColorStop(0, '#00ffc8');
      gradient.addColorStop(1, 'transparent');
    } else if (type === 'repel') {
      gradient.addColorStop(0, '#ff2a6d');
      gradient.addColorStop(1, 'transparent');
    } else {
      gradient.addColorStop(0, '#ffd700');
      gradient.addColorStop(1, 'transparent');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Center indicator
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = type === 'attract' ? '#00ffc8' : type === 'repel' ? '#ff2a6d' : '#ffd700';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = performance.now() * 0.05;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center dot
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawConnections(ctx) {
    if (prefersReducedMotion()) return;

    // Only draw connections occasionally for performance
    if (Math.random() > 0.02) return;

    const grid = new SpatialGrid(80);
    this.particles.forEach(p => {
      if (p.active) grid.insert(p);
    });

    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = '#00ffc8';
    ctx.lineWidth = 0.5;

    this.particles.forEach(p => {
      if (!p.active) return;
      const neighbors = grid.getNeighbors(p, 1);
      neighbors.forEach(n => {
        if (n === p || !n.active) return;
        const dist = Math.hypot(p.x - n.x, p.y - n.y);
        if (dist < 60) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();
        }
      });
    });

    ctx.restore();
  }

  destroy() {
    this.mouseDown = false;
    this.pool?.clear();
    this.particles.length = 0;
    super.destroy();
  }
}