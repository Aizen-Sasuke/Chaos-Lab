/**
 * CHAOS LAB — Experiment 1: Cursor Gravity
 * Particles orbit and react to cursor position
 */

import { Experiment } from '../core/Experiment.js';
import { Particle, ParticlePool, ForceField, SpatialGrid } from '../core/ParticleSystem.js';
import { random, randomChoice, clamp, lerp, hslToCss, getRandomAccent } from '../core/utils.js';

const COLORS = [
  '#00ffc8', // cyan
  '#7c4dff', // purple
  '#ffd700', // gold
  '#00e676', // green
  '#ff6d00', // orange
];

const PARTICLE_COUNT = 800;
const GRAVITY_STRENGTH = 8000;
const GRAVITY_RADIUS = 400;
const VORTEX_STRENGTH = 3000;

export class CursorGravityExperiment extends Experiment {
  constructor(options = {}) {
    super({ id: 'cursor-gravity', name: 'Cursor Gravity', ...options });

    this.particles = [];
    this.pool = null;
    this.forceField = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseButton = 0;
    this.mode = 'attract'; // attract, repel, vortex
    this.modeNames = ['attract', 'repel', 'vortex'];
    this.trails = [];
    this.maxTrails = 50;
    this.colorCycle = 0;
    this.showInfo = true;
  }

  async init(container) {
    await super.init(container);

    // Create force field at center initially
    this.forceField = new ForceField({
      x: this.width / 2,
      y: this.height / 2,
      strength: GRAVITY_STRENGTH,
      radius: GRAVITY_RADIUS,
      type: 'attract'
    });

    // Create particle pool
    this.pool = new ParticlePool(() => new Particle({
      radius: random(1.5, 4),
      color: randomChoice(COLORS),
      drag: 0.96,
      gravity: 0,
      bounce: 0.8,
      friction: 0.99
    }), PARTICLE_COUNT);

    // Initialize particles distributed across canvas
    const w = Math.max(300, this.width);
    const h = Math.max(300, this.height);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = this.pool.acquire({
        x: random(0, w),
        y: random(0, h),
        vx: random(-20, 20),
        vy: random(-20, 20),
        life: Infinity,
        maxLife: Infinity,
        fadeRate: 0
      });
      this.particles.push(p);
    }

    // Bind specific events
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('mousedown', e => {
      this.mouseDown = true;
      this.mouseButton = e.button;
    });
    this.canvas.addEventListener('mouseup', e => {
      this.mouseDown = false;
    });
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.cycleMode(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    // Show info overlay
    this.showOverlay(this.createInfoOverlay());

    // Update stats
    this.updateStats();

    return this;
  }

  createInfoOverlay() {
    const div = document.createElement('div');
    div.className = 'gravity-info';
    div.innerHTML = `
      <p>Move mouse to attract particles</p>
      <p><kbd>Click</kbd> Hold to ${this.getModeAction()}</p>
      <p><kbd>Scroll</kbd> / <kbd>Right-click</kbd> Cycle mode</p>
      <p><kbd>Space</kbd> Pause</p>
    `;
    return div;
  }

  getModeAction() {
    switch (this.mode) {
      case 'attract': return 'attract';
      case 'repel': return 'repel';
      case 'vortex': return 'vortex spin';
    }
  }

  cycleMode(direction = 1) {
    const idx = this.modeNames.indexOf(this.mode);
    const newIdx = (idx + direction + this.modeNames.length) % this.modeNames.length;
    this.mode = this.modeNames[newIdx];
    this.forceField.type = this.mode;
    this.forceField.strength = this.mode === 'vortex' ? VORTEX_STRENGTH : GRAVITY_STRENGTH;

    this.showToast(`Mode: ${this.mode.toUpperCase()}`, 'info', 1500);
    this.updateInfoOverlay();
  }

  updateInfoOverlay() {
    const overlay = document.getElementById('overlay');
    if (overlay) {
      overlay.querySelector('p:nth-child(2)').innerHTML = `<kbd>Click</kbd> Hold to ${this.getModeAction()}`;
    }
  }

  handlePointer(event) {
    super.handlePointer(event);

    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;

    this.forceField.setPosition(this.mouseX, this.mouseY);

    // Right click cycles mode
    if (event.type === 'pointerdown' && event.button === 2) {
      this.cycleMode();
    }
  }

  handleKeyboard(event) {
    super.handleKeyboard(event);

    if (event.key === ' ') {
      event.preventDefault();
      this.togglePause();
    }
  }

  update(dt) {
    if (this.paused) return;

    // Update force field position to mouse
    this.forceField.setPosition(this.mouseX, this.mouseY);

    // Apply forces to all particles
    this.particles.forEach(p => {
      if (!p.active) return;

      // Apply force field
      this.forceField.applyTo(p, dt);

      // Subtle noise for organic motion
      const noise = Math.sin(p.x * 0.005 + performance.now() * 0.001) *
                   Math.cos(p.y * 0.005 + performance.now() * 0.0013);
      p.vx += noise * 10 * dt * 60;
      p.vy += noise * 10 * dt * 60;

      // Mouse down adds extra force
      if (this.mouseDown) {
        const dx = this.mouseX - p.x;
        const dy = this.mouseY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 5 && dist < GRAVITY_RADIUS * 1.5) {
          const force = (this.mode === 'repel' ? -1 : 1) * 5000 / (dist * dist);
          p.vx += (dx / dist) * force * dt * 60;
          p.vy += (dy / dist) * force * dt * 60;
        }
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

    this.updateStats();
  }

  updateStats() {
    const statCount = document.getElementById('particle-count');
    if (statCount) {
      statCount.textContent = this.particles.filter(p => p.active).length;
    }
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

      // Glow effect for fast particles
      if (speed > 100) {
        ctx.shadowColor = hslToCss(hue, saturation, lightness);
        ctx.shadowBlur = 10;
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
    this.pool?.clear();
    this.particles.length = 0;
    super.destroy();
  }
}