/**
 * CHAOS LAB — Shared Particle System
 * High-performance particle utilities for all experiments
 */

import { random, randomChoice, clamp, lerp, hslToRgb, rgbToCss, getRandomAccent } from './utils.js';

// ========================================
// Particle Class
// ========================================

export class Particle {
  constructor(options = {}) {
    this.id = options.id || Math.random().toString(36).slice(2);
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.vx = options.vx || 0;
    this.vy = options.vy || 0;
    this.ax = 0;
    this.ay = 0;

    this.radius = options.radius || random(2, 6);
    this.baseRadius = this.radius;
    this.mass = options.mass || this.radius * 0.5;

    this.life = options.life || 1;
    this.maxLife = this.life;
    this.age = 0;

    this.color = options.color || getRandomAccent();
    this.alpha = options.alpha !== undefined ? options.alpha : 1;
    this.fadeRate = options.fadeRate || 0.01;

    this.rotation = options.rotation || 0;
    this.rotationSpeed = options.rotationSpeed || 0;

    this.shape = options.shape || 'circle'; // circle, square, triangle, star
    this.sides = options.sides || 5;

    this.gravity = options.gravity || 0;
    this.drag = options.drag !== undefined ? options.drag : 0.98;
    this.bounce = options.bounce || 0.6;
    this.friction = options.friction || 1;

    this.trail = options.trail || false;
    this.trailLength = options.trailLength || 10;
    this.trailPositions = [];

    this.customUpdate = options.customUpdate || null;
    this.customDraw = options.customDraw || null;

    this.active = true;
    this.data = options.data || {};
  }

  /**
   * Apply force to particle
   */
  applyForce(fx, fy) {
    this.ax += fx / this.mass;
    this.ay += fy / this.mass;
  }

  /**
   * Apply force towards a target
   */
  attractTo(tx, ty, strength = 1, minDist = 5, maxDist = 500) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < minDist) return;
    if (dist > maxDist) return;

    const force = (strength * this.mass) / (dist * dist);
    this.ax += (dx / dist) * force;
    this.ay += (dy / dist) * force;
  }

  /**
   * Repel from a point
   */
  repelFrom(rx, ry, strength = 1, minDist = 5, maxDist = 200) {
    const dx = this.x - rx;
    const dy = this.y - ry;
    const dist = Math.hypot(dx, dy);

    if (dist < minDist) return;
    if (dist > maxDist) return;

    const force = (strength * this.mass) / (dist * dist);
    this.ax += (dx / dist) * force;
    this.ay += (dy / dist) * force;
  }

  /**
   * Update particle physics
   */
  update(dt, bounds = null) {
    if (!this.active) return false;

    // Custom update
    if (this.customUpdate) {
      this.customUpdate(this, dt);
    }

    // Physics
    this.vx += this.ax * dt * 60;
    this.vy += this.ay * dt * 60;

    this.vx *= this.drag;
    this.vy *= this.drag;

    this.vy += this.gravity * dt * 60;

    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    this.rotation += this.rotationSpeed * dt * 60;

    // Reset acceleration
    this.ax = 0;
    this.ay = 0;

    // Trail
    if (this.trail) {
      this.trailPositions.unshift({ x: this.x, y: this.y, alpha: this.alpha });
      if (this.trailPositions.length > this.trailLength) {
        this.trailPositions.pop();
      }
    }

    // Life & Fade decay
    if (this.fadeRate > 0) {
      this.alpha = Math.max(0, this.alpha - this.fadeRate * dt * 60);
    }

    if (Number.isFinite(this.maxLife) && this.maxLife > 0) {
      this.age += dt;
      this.life = Math.max(0, this.maxLife - this.age);
      if (this.maxLife > 0) {
        this.radius = this.baseRadius * (this.life / this.maxLife);
      }
      if (this.life <= 0) {
        this.active = false;
        return false;
      }
    }

    if (this.alpha <= 0) {
      this.active = false;
      return false;
    }

    // Bounds checking
    if (bounds) {
      this.checkBounds(bounds);
    }

    return true;
  }

  /**
   * Handle boundary collisions
   */
  checkBounds(bounds) {
    const { left = 0, top = 0, right, bottom } = bounds;
    const r = this.radius;

    if (this.x - r < left) {
      this.x = left + r;
      this.vx *= -this.bounce;
      this.vy *= this.friction;
    } else if (this.x + r > right) {
      this.x = right - r;
      this.vx *= -this.bounce;
      this.vy *= this.friction;
    }

    if (this.y - r < top) {
      this.y = top + r;
      this.vy *= -this.bounce;
      this.vx *= this.friction;
    } else if (this.y + r > bottom) {
      this.y = bottom - r;
      this.vy *= -this.bounce;
      this.vx *= this.friction;
    }
  }

  /**
   * Draw particle to canvas context
   */
  draw(ctx) {
    if (!this.active || this.alpha <= 0) return;

    // Custom draw
    if (this.customDraw) {
      this.customDraw(this, ctx);
      return;
    }

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Draw trail
    if (this.trail && this.trailPositions.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.trailPositions[0].x - this.x, this.trailPositions[0].y - this.y);
      for (let i = 1; i < this.trailPositions.length; i++) {
        const p = this.trailPositions[i];
        ctx.lineTo(p.x - this.x, p.y - this.y);
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.radius * 0.5;
      ctx.globalAlpha = this.alpha * 0.3;
      ctx.stroke();
      ctx.globalAlpha = this.alpha;
    }

    // Draw shape
    ctx.fillStyle = this.color;

    switch (this.shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'square':
        const half = this.radius;
        ctx.fillRect(-half, -half, half * 2, half * 2);
        break;

      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius * 0.866, this.radius * 0.5);
        ctx.lineTo(-this.radius * 0.866, this.radius * 0.5);
        ctx.closePath();
        ctx.fill();
        break;

      case 'star':
        this.drawStar(ctx, this.radius);
        break;

      default:
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  }

  drawStar(ctx, radius) {
    const spikes = 5;
    const outerRadius = radius;
    const innerRadius = radius * 0.4;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(0, -outerRadius);

    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = i * step - Math.PI / 2;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Check if particle is dead
   */
  isDead() {
    return !this.active || this.life <= 0 || this.alpha <= 0;
  }
}

// ========================================
// Particle Pool (Object Pooling for Performance)
// ========================================

export class ParticlePool {
  constructor(createFn, initialSize = 100) {
    this.createFn = createFn;
    this.pool = [];
    this.active = [];
    this.expand(initialSize);
  }

  expand(count) {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.createFn());
    }
  }

  acquire(options = {}) {
    let particle = this.pool.pop();
    if (!particle) {
      particle = this.createFn();
      this.expand(10); // Expand pool
    }
    // Reset particle properties
    particle.age = 0;
    particle.active = true;
    particle.alpha = options.alpha !== undefined ? options.alpha : 1;
    particle.life = options.life !== undefined ? options.life : 1;
    particle.maxLife = options.maxLife !== undefined ? options.maxLife : particle.life;
    particle.radius = options.radius !== undefined ? options.radius : (particle.baseRadius || 2);
    particle.baseRadius = particle.radius;
    particle.fadeRate = options.fadeRate !== undefined ? options.fadeRate : 0.01;
    Object.assign(particle, options);
    this.active.push(particle);
    return particle;
  }

  release(particle) {
    const idx = this.active.indexOf(particle);
    if (idx !== -1) {
      this.active.splice(idx, 1);
      particle.active = false;
      this.pool.push(particle);
    }
  }

  updateAll(dt, bounds) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      if (!p.update(dt, bounds)) {
        this.release(p);
      }
    }
  }

  drawAll(ctx) {
    this.active.forEach(p => p.draw(ctx));
  }

  getActiveCount() {
    return this.active.length;
  }

  getPoolSize() {
    return this.pool.length + this.active.length;
  }

  clear() {
    this.active.forEach(p => this.pool.push(p));
    this.active.length = 0;
  }
}

// ========================================
// Particle Emitter
// ========================================

export class ParticleEmitter {
  constructor(options = {}) {
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.rate = options.rate || 10; // particles per second
    this.burstCount = options.burstCount || 0;
    this.emitFn = options.emitFn || this.defaultEmit.bind(this);
    this.particleOptions = options.particleOptions || {};
    this.active = true;
    this.timer = 0;
    this.particles = [];
    this.maxParticles = options.maxParticles || 500;
  }

  defaultEmit(emitter) {
    const angle = random(0, Math.PI * 2);
    const speed = random(emitter.particleOptions.minSpeed || 50, emitter.particleOptions.maxSpeed || 200);
    return {
      x: emitter.x,
      y: emitter.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: random(emitter.particleOptions.minRadius || 2, emitter.particleOptions.maxRadius || 6),
      color: emitter.particleOptions.color || getRandomAccent(),
      life: random(emitter.particleOptions.minLife || 0.5, emitter.particleOptions.maxLife || 2),
      fadeRate: emitter.particleOptions.fadeRate || 0.02,
      gravity: emitter.particleOptions.gravity || 0,
      drag: emitter.particleOptions.drag || 0.98
    };
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  emit(count = 1) {
    if (!this.active) return [];

    const newParticles = [];
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const options = this.emitFn(this);
      const particle = new Particle(options);
      this.particles.push(particle);
      newParticles.push(particle);
    }
    return newParticles;
  }

  burst(count) {
    return this.emit(count);
  }

  update(dt, bounds) {
    this.timer += dt;

    // Continuous emission
    if (this.rate > 0) {
      const emitCount = Math.floor(this.timer * this.rate);
      if (emitCount > 0) {
        this.emit(emitCount);
        this.timer -= emitCount / this.rate;
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (!this.particles[i].update(dt, bounds)) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    this.particles.forEach(p => p.draw(ctx));
  }

  getCount() {
    return this.particles.length;
  }

  clear() {
    this.particles.length = 0;
  }

  stop() {
    this.active = false;
  }

  start() {
    this.active = true;
  }
}

// ========================================
// Text to Particles Helper
// ========================================

export class TextParticleizer {
  constructor(options = {}) {
    this.font = options.font || 'bold 200px Space Grotesk';
    this.text = options.text || '';
    this.particleSize = options.particleSize || 4;
    this.gap = options.gap || 1;
    this.colors = options.colors || ['#00ffc8', '#ff2a6d', '#ffd700', '#7c4dff'];
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  setText(text) {
    this.text = text;
  }

  setFont(font) {
    this.font = font;
  }

  /**
   * Generate particles from text
   */
  generate() {
    if (!this.text) return [];

    this.ctx.font = this.font;
    const metrics = this.ctx.measureText(this.text);
    const textWidth = metrics.width;
    const textHeight = parseInt(this.font) * 1.2;

    // Size canvas
    const padding = 20;
    this.canvas.width = textWidth + padding * 2;
    this.canvas.height = textHeight + padding * 2;

    // Draw text
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.font = this.font;
    this.ctx.fillStyle = '#fff';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(this.text, padding, padding);

    // Get pixel data
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const pixels = imageData.data;

    const particles = [];
    const step = this.particleSize + this.gap;

    for (let y = 0; y < this.canvas.height; y += step) {
      for (let x = 0; x < this.canvas.width; x += step) {
        const idx = (y * this.canvas.width + x) * 4;
        const alpha = pixels[idx + 3];

        if (alpha > 128) {
          particles.push({
            x: x - padding,
            y: y - padding,
            targetX: x - padding,
            targetY: y - padding,
            color: randomChoice(this.colors),
            radius: this.particleSize * 0.5
          });
        }
      }
    }

    return particles;
  }

  /**
   * Get text bounds
   */
  getBounds() {
    this.ctx.font = this.font;
    const metrics = this.ctx.measureText(this.text);
    return {
      width: metrics.width,
      height: parseInt(this.font) * 1.2
    };
  }
}

// ========================================
// Force Field (for cursor gravity)
// ========================================

export class ForceField {
  constructor(options = {}) {
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.strength = options.strength || 1000;
    this.radius = options.radius || 300;
    this.type = options.type || 'attract'; // attract, repel, vortex, noise
    this.noiseScale = options.noiseScale || 0.01;
    this.noiseTime = 0;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  applyTo(particle, dt) {
    const dx = this.x - particle.x;
    const dy = this.y - particle.y;
    const dist = Math.hypot(dx, dy);

    if (dist === 0 || dist > this.radius) return;

    const normalizedDist = dist / this.radius;
    let force = 0;

    switch (this.type) {
      case 'attract':
        force = this.strength * (1 - normalizedDist) / (dist * dist);
        particle.vx += (dx / dist) * force * dt * 60;
        particle.vy += (dy / dist) * force * dt * 60;
        break;

      case 'repel':
        force = this.strength * (1 - normalizedDist) / (dist * dist);
        particle.vx -= (dx / dist) * force * dt * 60;
        particle.vy -= (dy / dist) * force * dt * 60;
        break;

      case 'vortex':
        // Tangential force for vortex effect
        const tangentX = -dy / dist;
        const tangentY = dx / dist;
        force = this.strength * (1 - normalizedDist) / dist;
        particle.vx += tangentX * force * dt * 60;
        particle.vy += tangentY * force * dt * 60;
        // Also slight attraction to center
        particle.vx += (dx / dist) * force * 0.1 * dt * 60;
        particle.vy += (dy / dist) * force * 0.1 * dt * 60;
        break;

      case 'noise':
        this.noiseTime += dt;
        const noise = this.noise2D(particle.x * this.noiseScale, particle.y * this.noiseScale + this.noiseTime);
        const angle = noise * Math.PI * 2;
        force = this.strength * (1 - normalizedDist);
        particle.vx += Math.cos(angle) * force * dt * 60;
        particle.vy += Math.sin(angle) * force * dt * 60;
        break;
    }
  }

  // Simple 2D noise function
  noise2D(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }
}

// ========================================
// Spatial Grid (for neighbor queries)
// ========================================

export class SpatialGrid {
  constructor(cellSize = 50) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  _getKey(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  insert(particle) {
    const key = this._getKey(particle.x, particle.y);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key).push(particle);
  }

  clear() {
    this.grid.clear();
  }

  getNeighbors(particle, radius = 1) {
    const neighbors = [];
    const cx = Math.floor(particle.x / this.cellSize);
    const cy = Math.floor(particle.y / this.cellSize);

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.grid.get(key);
        if (cell) neighbors.push(...cell);
      }
    }

    return neighbors;
  }

  getAllInRadius(x, y, radius) {
    const results = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.grid.get(key);
        if (cell) {
          cell.forEach(p => {
            const dist = Math.hypot(p.x - x, p.y - y);
            if (dist <= radius) results.push(p);
          });
        }
      }
    }

    return results;
  }
}

export default {
  Particle,
  ParticlePool,
  ParticleEmitter,
  TextParticleizer,
  ForceField,
  SpatialGrid
};