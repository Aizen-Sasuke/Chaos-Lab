/**
 * CHAOS LAB — Base Experiment Class
 * All experiments extend this base class
 */

import { EventEmitter } from './utils.js';

export class Experiment extends EventEmitter {
  constructor(options = {}) {
    super();
    this.id = options.id || 'experiment';
    this.name = options.name || 'Unnamed Experiment';
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;
    this.running = false;
    this.paused = false;
    this.initialized = false;
    this.destroyed = false;
    this.rafLoop = null;
    this.performanceMonitor = null;
    this.resizeHandler = null;
    this.pointerHandler = null;
    this.keyboardHandler = null;
    this.hud = null;
  }

  /**
   * Called once when experiment is first mounted
   * Override to set up canvas, event listeners, initial state
   */
  async init(container) {
    this.container = container;
    this.createCanvas();
    this.bindEvents();
    this.initialized = true;
    this.emit('init');
    return this;
  }

  /**
   * Create and configure the canvas element
   */
  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'experiment-canvas';
    this.canvas.id = `exp-${this.id}`;
    this.canvas.setAttribute('aria-label', `${this.name} experiment`);
    this.ctx = this.canvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
      willReadFrequently: false
    });
    this.container.appendChild(this.canvas);

    // Experiment UI lives in a HUD layer that is sized to the canvas rather
    // than the whole window. It never covers the play area and is transparent
    // to pointer events except for its interactive children.
    this.hud = document.createElement('div');
    this.hud.className = 'experiment-hud';
    this.container.appendChild(this.hud);

    this.resize();
  }

  /**
   * Bind resize, pointer, keyboard events
   */
  bindEvents() {
    this.resizeHandler = this.handleResize.bind(this);
    window.addEventListener('resize', this.resizeHandler);

    // Pointer events (mouse + touch). Movement stays canvas-scoped so cursor
    // coordinates are always canvas-relative; pointerup is bound on the window
    // only (canvas events bubble) so a drag released outside still ends.
    this.pointerHandler = this.handlePointer.bind(this);
    this.canvas.addEventListener('pointermove', this.pointerHandler);
    this.canvas.addEventListener('pointerdown', this.pointerHandler);
    this.canvas.addEventListener('pointerleave', this.pointerHandler);
    this.canvas.addEventListener('pointercancel', this.pointerHandler);
    window.addEventListener('pointerup', this.pointerHandler);

    // Keyboard events
    this.keyboardHandler = this.handleKeyboard.bind(this);
    window.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Handle window resize
   */
  handleResize() {
    this.resize();
    this.emit('resize', { width: this.width, height: this.height });
  }

  /**
   * Resize canvas to match container
   */
  resize() {
    if (!this.canvas || !this.container) return;

    const rect = this.container.getBoundingClientRect();
    // Cap DPR at 2: on 3x phones the canvas otherwise renders 9x the pixels
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // The canvas is laid out inside the container's content box. Using the
    // border-box width here would make the inline size larger than the CSS
    // max-width, so the browser would scale the bitmap down and pointer
    // coordinates would stop matching simulation coordinates.
    const styles = getComputedStyle(this.container);
    const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    const contentW = Math.floor(this.container.clientWidth - padX);
    const contentH = Math.floor(this.container.clientHeight - padY);

    const containerW = contentW > 0 ? contentW : (Math.floor(rect.width) || window.innerWidth || 800);
    const containerH = contentH > 0 ? contentH : (Math.floor(rect.height) || Math.max(400, window.innerHeight - 200));

    this.width = Math.max(1, containerW);
    this.height = Math.max(1, containerH);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Align the HUD with the canvas' rendered rect. The canvas can be clamped
    // by max-width/max-height and centred by the flex viewport, so measuring
    // is more reliable than copying the canvas' inline size.
    if (this.hud) {
      const hostRect = this.container.getBoundingClientRect();
      const canvasRect = this.canvas.getBoundingClientRect();
      this.hud.style.left = `${canvasRect.left - hostRect.left}px`;
      this.hud.style.top = `${canvasRect.top - hostRect.top}px`;
      this.hud.style.width = `${canvasRect.width}px`;
      this.hud.style.height = `${canvasRect.height}px`;
    }

    this.emit('resize', { width: this.width, height: this.height });
  }

  /**
   * Handle pointer events (mouse/touch)
   * Override in subclass
   */
  handlePointer(event) {
    // Normalize coordinates
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.emit('pointer', {
      type: event.type,
      x, y,
      pressure: event.pressure || 1,
      pointerId: event.pointerId,
      button: event.button,
      isTouch: event.pointerType === 'touch'
    });
  }

  /**
   * Handle keyboard events
   * Override in subclass
   */
  handleKeyboard(event) {
    this.emit('keyboard', {
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      repeat: event.repeat
    });
  }

  /**
   * Start the experiment animation loop
   */
  start() {
    if (this.running || this.destroyed) return;

    this.running = true;
    this.paused = false;
    this.performanceMonitor = this.performanceMonitor || new PerformanceMonitor();

    // Use requestAnimationFrame directly for more control
    this.animate();
    this.emit('start');
  }

  /**
   * Main animation loop
   */
  animate = (time = 0) => {
    if (!this.running || this.destroyed) return;

    if (!this.paused) {
      const rawDt = this.lastTime ? (time - this.lastTime) / 1000 : 1 / 60;
      // Clamp so a background tab or a long frame can't teleport the simulation
      const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), 0.05) : 1 / 60;
      this.lastTime = time;

      this.update(dt);
      this.render();
      this.performanceMonitor?.tick();
    } else {
      this.lastTime = time;
    }

    this.rafId = requestAnimationFrame(this.animate);
  };

  /**
   * Update simulation state (called each frame)
   * Override in subclass
   */
  update(dt) {
    // Override me
  }

  /**
   * Render to canvas (called each frame)
   * Override in subclass
   */
  render() {
    // Override me
  }

  /**
   * Pause the experiment
   */
  pause() {
    this.paused = true;
    this.showPauseIndicator();
    this.emit('pause');
  }

  /**
   * Resume the experiment
   */
  resume() {
    this.paused = false;
    this.hidePauseIndicator();
    this.lastTime = performance.now();
    this.emit('resume');
  }

  showPauseIndicator() {
    let pauseEl = document.getElementById('pause-indicator');
    if (!pauseEl) {
      pauseEl = document.createElement('div');
      pauseEl.id = 'pause-indicator';
      pauseEl.className = 'pause-overlay';
      pauseEl.innerHTML = `
        <div class="pause-icon">⏸</div>
        <p>PAUSED</p>
        <p style="font-size: 0.75rem; color: var(--fg-subtle);">Press Space to resume</p>
      `;
      if (this.container) this.container.appendChild(pauseEl);
    }
  }

  hidePauseIndicator() {
    const pauseEl = document.getElementById('pause-indicator');
    if (pauseEl) pauseEl.remove();
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  /**
   * Show overlay content (for experiment-specific UI)
   */
  showOverlay(content) {
    if (!this.hud) return;
    this.hud.innerHTML = '';
    if (typeof content === 'string') {
      this.hud.innerHTML = content;
    } else if (content instanceof Node) {
      this.hud.appendChild(content);
    }
  }

  /**
   * Hide overlay
   */
  hideOverlay() {
    if (this.hud) {
      this.hud.innerHTML = '';
    }
  }

  /**
   * Show a toast notification
   */
  showToast(message, type = 'info', duration = 3000) {
    // Remove existing toasts
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Force reflow then show
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Clean up and destroy the experiment
   */
  destroy() {
    if (this.destroyed) return;

    this.running = false;
    this.destroyed = true;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    // Remove event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    if (this.pointerHandler) {
      if (this.canvas) {
        this.canvas.removeEventListener('pointermove', this.pointerHandler);
        this.canvas.removeEventListener('pointerdown', this.pointerHandler);
        this.canvas.removeEventListener('pointerleave', this.pointerHandler);
        this.canvas.removeEventListener('pointercancel', this.pointerHandler);
      }
      window.removeEventListener('pointerup', this.pointerHandler);
    }
    if (this.keyboardHandler) {
      window.removeEventListener('keydown', this.keyboardHandler);
    }

    // Remove canvas
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.hideOverlay();
    if (this.hud && this.hud.parentNode) {
      this.hud.parentNode.removeChild(this.hud);
    }
    this.hud = null;
    this.hidePauseIndicator();
    // Emit before clearing so listeners actually receive the event
    this.emit('destroy');
    this.clear(); // Clear all event listeners from EventEmitter
  }

  /**
   * Number of live particles, used by the shared stats readout.
   * Override in subclasses.
   */
  getParticleCount() {
    return 0;
  }

  /**
   * Get current performance stats
   */
  getStats() {
    return {
      fps: this.performanceMonitor?.getFPS() || 0,
      running: this.running,
      paused: this.paused,
      width: this.width,
      height: this.height,
      particleCount: this.getParticleCount()
    };
  }
}

/**
 * PerformanceMonitor for experiments
 */
class PerformanceMonitor {
  constructor() {
    this.frames = [];
    this.lastTime = performance.now();
    this.fps = 60;
  }

  tick() {
    const now = performance.now();
    this.frames.push(now);
    const cutoff = now - 1000;
    while (this.frames.length > 0 && this.frames[0] < cutoff) {
      this.frames.shift();
    }
    this.fps = Math.round(this.frames.length);
  }

  getFPS() {
    return this.fps;
  }
}

export default Experiment;