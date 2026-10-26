/**
 * CHAOS LAB — Ambient Background
 * Subtle animated background for the bg-canvas
 */

import { random, randomChoice, lerp, hslToCss, prefersReducedMotion } from './utils.js';

export class AmbientBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;
    this.running = false;
    this.particles = [];
    this.lines = [];
    this.time = 0;
    this.resizeHandler = this.handleResize.bind(this);
  }

  init() {
    this.resize();
    window.addEventListener('resize', this.resizeHandler);
    this.createParticles();
    this.createLines();
    this.start();
  }

  handleResize() {
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  createParticles() {
    const reduced = prefersReducedMotion();
    const count = reduced ? 12 : Math.min(60, Math.floor((this.width * this.height) / 15000));
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: random(0, this.width),
        y: random(0, this.height),
        vx: random(-0.3, 0.3),
        vy: random(-0.3, 0.3),
        radius: random(0.5, 2),
        baseRadius: random(0.5, 2),
        color: randomChoice(['#00ffc8', '#ff2a6d', '#ffd700', '#7c4dff']),
        alpha: random(0.05, 0.2),
        phase: random(0, Math.PI * 2),
        speed: random(0.0005, 0.002)
      });
    }
  }

  createLines() {
    this.lines = [];
    const count = 3;
    for (let i = 0; i < count; i++) {
      this.lines.push({
        y: random(0, this.height),
        speed: random(0.02, 0.05) * (random() > 0.5 ? 1 : -1),
        alpha: random(0.02, 0.06),
        color: randomChoice(['#00ffc8', '#ff2a6d', '#ffd700'])
      });
    }
  }

  start() {
    this.running = true;
    this.animate();
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('resize', this.resizeHandler);
  }

  animate = (time = 0) => {
    if (!this.running) return;

    const rawDt = (time - this.time) / 1000;
    const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), 0.05) : 1 / 60;
    this.time = time;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.animate);
  };

  update(dt) {
    const slowDt = dt * 0.5; // Very slow movement

    // Update particles
    this.particles.forEach(p => {
      p.x += p.vx * slowDt * 60;
      p.y += p.vy * slowDt * 60;
      p.phase += p.speed * slowDt * 60;
      p.radius = p.baseRadius * (0.8 + Math.sin(p.phase) * 0.2);

      // Wrap around
      if (p.x < -p.radius) p.x = this.width + p.radius;
      if (p.x > this.width + p.radius) p.x = -p.radius;
      if (p.y < -p.radius) p.y = this.height + p.radius;
      if (p.y > this.height + p.radius) p.y = -p.radius;

      // Subtle drift
      p.vx += (random() - 0.5) * 0.001;
      p.vy += (random() - 0.5) * 0.001;
      const drift = Math.pow(0.999, dt * 60);
      p.vx *= drift;
      p.vy *= drift;
    });

    // Update scan lines
    this.lines.forEach(line => {
      line.y += line.speed * slowDt * 60;
      if (line.y < 0) line.y = this.height;
      if (line.y > this.height) line.y = 0;
    });
  }

  render() {
    const ctx = this.ctx;

    // Clear
    ctx.clearRect(0, 0, this.width, this.height);

    // Draw scan lines
    ctx.save();
    this.lines.forEach(line => {
      ctx.globalAlpha = line.alpha;
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, line.y);
      ctx.lineTo(this.width, line.y);
      ctx.stroke();
    });
    ctx.restore();

    // Draw particles
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Draw subtle connections (very few)
    if (Math.random() < 0.01) {
      ctx.save();
      ctx.globalAlpha = 0.02;
      ctx.strokeStyle = '#00ffc8';
      ctx.lineWidth = 0.5;

      for (let i = 0; i < this.particles.length; i += 3) {
        const p1 = this.particles[i];
        for (let j = i + 1; j < Math.min(i + 4, this.particles.length); j++) {
          const p2 = this.particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  }
}

export default AmbientBackground;