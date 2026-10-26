/**
 * CHAOS LAB — Experiment Manager
 * Handles loading, switching, and lifecycle of experiments
 */

import { EventEmitter } from './utils.js';
import { Experiment } from './Experiment.js';

export class ExperimentManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.viewport = options.viewport;
    this.switcher = options.switcher;
    this.experiments = new Map(); // id -> Experiment class
    this.instances = new Map();   // id -> Experiment instance
    this.currentId = null;
    this.currentInstance = null;
    this.transitioning = false;
    this.queuedId = null;
    this.switcherClickHandler = null;
    this.resizeHandler = null;
    this.keyHandler = null;
    this.keys = {
      '1': 'cursor-gravity',
      '2': 'cursed-button',
      '3': 'name-particles'
    };
  }

  /**
   * Register an experiment class
   */
  register(id, ExperimentClass, metadata = {}) {
    if (!(ExperimentClass.prototype instanceof Experiment)) {
      throw new Error(`Experiment "${id}" must extend base Experiment class`);
    }
    this.experiments.set(id, { class: ExperimentClass, metadata });
    this.emit('register', id, metadata);
    return this;
  }

  /**
   * Register multiple experiments at once
   */
  registerAll(experiments) {
    Object.entries(experiments).forEach(([id, { class: Class, ...metadata }]) => {
      this.register(id, Class, metadata);
    });
    return this;
  }

  /**
   * Initialize the manager - create switcher UI, bind keys
   */
  async init(defaultId = null) {
    this.bindSwitcher();
    this.bindKeyboard();

    // Start with first registered experiment or default
    const firstId = defaultId || this.experiments.keys().next().value;
    if (firstId) {
      await this.switchTo(firstId, { animate: false });
    }

    // The switcher indicator is positioned from measured rects, so it has to be
    // recalculated whenever the layout changes (resize / orientation change).
    this.resizeHandler = () => this.updateSwitcherUI(this.currentId);
    window.addEventListener('resize', this.resizeHandler);

    this.emit('ready');
    return this;
  }

  /**
   * Bind switcher button clicks
   */
  bindSwitcher() {
    if (!this.switcher) return;

    this.switcherClickHandler = (e) => {
      const btn = e.target.closest('.switcher-btn');
      if (btn && btn.dataset.exp) {
        this.switchTo(btn.dataset.exp);
      }
    };
    this.switcher.addEventListener('click', this.switcherClickHandler);
  }

  /**
   * Bind keyboard shortcuts (1, 2, 3, Space)
   */
  bindKeyboard() {
    this.keyHandler = (e) => {
      const target = e.target;
      const tag = target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;

      // Ignore if typing in a form control
      if (typing) return;

      if (this.keys[e.key]) {
        e.preventDefault();
        this.switchTo(this.keys[e.key]);
      } else if (e.key === ' ' || e.code === 'Space') {
        // Space is the "activate" key for focused buttons/links. Don't turn a
        // button press into a paused experiment at the same time.
        if (tag === 'BUTTON' || tag === 'A') return;
        e.preventDefault();
        this.togglePause();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  /**
   * Switch to a different experiment
   */
  async switchTo(id, options = {}) {
    const { animate = true, force = false } = options;

    // A switch is already animating: remember the latest request instead of
    // silently dropping the tab click.
    if (this.transitioning && !force) {
      this.queuedId = id;
      return false;
    }
    if (this.currentId === id && !force) return false;
    if (!this.experiments.has(id)) {
      console.warn(`Experiment "${id}" not registered`);
      return false;
    }

    this.transitioning = true;
    this.emit('beforeSwitch', { from: this.currentId, to: id });

    // Update switcher UI immediately
    this.updateSwitcherUI(id);

    // Exit current experiment
    if (this.currentInstance) {
      if (animate) {
        this.currentInstance.canvas?.classList.add('experiment-exit');
        await this.wait(200);
      }
      this.currentInstance.destroy();
      this.currentInstance = null;
    }

    // Clear viewport
    if (this.viewport) {
      this.viewport.innerHTML = '';
    }

    // Create and init new experiment
    const { class: ExperimentClass, metadata } = this.experiments.get(id);
    this.currentInstance = new ExperimentClass({ id, ...metadata });

    try {
      await this.currentInstance.init(this.viewport);
      this.currentId = id;
      this.currentInstance.start();

      // Entrance animation
      if (animate && this.currentInstance.canvas) {
        this.currentInstance.canvas.classList.add('experiment-enter');
        await this.wait(300);
        this.currentInstance.canvas.classList.remove('experiment-enter');
      }

      this.emit('switch', { id, metadata });
    } catch (error) {
      console.error(`Failed to initialize experiment "${id}":`, error);
      // Don't leave a half-initialized instance or stale id behind
      try { this.currentInstance?.destroy(); } catch { /* ignore */ }
      this.currentInstance = null;
      this.currentId = null;
      this.showError(id, error);
      this.emit('switchError', { id, error });
      return false;
    } finally {
      this.transitioning = false;

      const queued = this.queuedId;
      this.queuedId = null;
      if (queued && queued !== this.currentId) {
        this.switchTo(queued);
      }
    }

    return true;
  }

  /**
   * Update switcher button states and indicator
   */
  updateSwitcherUI(activeId) {
    if (!this.switcher) return;

    const buttons = this.switcher.querySelectorAll('.switcher-btn');
    buttons.forEach(btn => {
      const isActive = btn.dataset.exp === activeId;
      btn.setAttribute('aria-selected', isActive);
      if (isActive) {
        // Position indicator
        const rect = btn.getBoundingClientRect();
        const track = this.switcher.querySelector('.switcher-track');
        if (track) {
          const trackRect = track.getBoundingClientRect();
          const indicator = document.getElementById('switcher-indicator');
          if (indicator) {
            indicator.style.width = `${rect.width}px`;
            indicator.style.transform = `translateX(${rect.left - trackRect.left}px)`;
          }
        }
      }
    });
  }

  /**
   * Toggle pause on current experiment
   */
  togglePause() {
    if (this.currentInstance) {
      this.currentInstance.togglePause();
      this.emit('pauseToggle', { paused: this.currentInstance.paused });
    }
  }

  /**
   * Get current experiment instance
   */
  getCurrent() {
    return this.currentInstance;
  }

  /**
   * Get current experiment ID
   */
  getCurrentId() {
    return this.currentId;
  }

  /**
   * Get list of all registered experiments
   */
  getAll() {
    return Array.from(this.experiments.entries()).map(([id, { metadata }]) => ({ id, ...metadata }));
  }

  /**
   * Show error in viewport
   */
  showError(id, error) {
    if (!this.viewport) return;

    this.viewport.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'experiment-error';

    const heading = document.createElement('h3');
    heading.textContent = 'Experiment Failed';

    const message = document.createElement('p');
    message.textContent = `Could not load ${id}`;

    const detail = document.createElement('pre');
    detail.style.cssText = 'color: var(--fg-muted); font-size: 0.75rem; max-height: 200px; overflow: auto; text-align: left;';
    detail.textContent = `${error.message}\n${error.stack || ''}`;

    const reload = document.createElement('button');
    reload.textContent = 'Reload Page';
    reload.addEventListener('click', () => location.reload());

    wrap.append(heading, message, detail, reload);
    this.viewport.appendChild(wrap);
  }

  /**
   * Destroy manager and current experiment
   */
  destroy() {
    if (this.currentInstance) {
      this.currentInstance.destroy();
      this.currentInstance = null;
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
    if (this.switcherClickHandler && this.switcher) {
      this.switcher.removeEventListener('click', this.switcherClickHandler);
      this.switcherClickHandler = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.clear();
  }

  /**
   * Utility: wait for ms
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ExperimentManager;