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

    this.emit('ready');
    return this;
  }

  /**
   * Bind switcher button clicks
   */
  bindSwitcher() {
    if (!this.switcher) return;

    this.switcher.addEventListener('click', (e) => {
      const btn = e.target.closest('.switcher-btn');
      if (btn && btn.dataset.exp) {
        this.switchTo(btn.dataset.exp);
      }
    });
  }

  /**
   * Bind keyboard shortcuts (1, 2, 3, Space)
   */
  bindKeyboard() {
    this.keyHandler = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (this.keys[e.key]) {
        e.preventDefault();
        this.switchTo(this.keys[e.key]);
      } else if (e.key === ' ' || e.code === 'Space') {
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

    if (this.transitioning && !force) return false;
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

      // Entrance animation
      if (animate) {
        this.currentInstance.canvas.classList.add('experiment-enter');
        await this.wait(400);
        this.currentInstance.canvas.classList.remove('experiment-enter');
      }

      this.currentId = id;
      this.currentInstance.start();

      this.emit('switch', { id, metadata });
    } catch (error) {
      console.error(`Failed to initialize experiment "${id}":`, error);
      this.showError(id, error);
      this.transitioning = false;
      return false;
    }

    this.transitioning = false;
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
        const trackRect = this.switcher.querySelector('.switcher-track').getBoundingClientRect();
        const indicator = document.getElementById('switcher-indicator');
        if (indicator) {
          indicator.style.width = `${rect.width}px`;
          indicator.style.transform = `translateX(${rect.left - trackRect.left}px)`;
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

    this.viewport.innerHTML = `
      <div class="experiment-error">
        <h3>Experiment Failed</h3>
        <p>Could not load <code>${id}</code></p>
        <pre style="color: var(--fg-muted); font-size: 0.75rem; max-height: 200px; overflow: auto; text-align: left;">${error.message}\n${error.stack || ''}</pre>
        <button onclick="location.reload()">Reload Page</button>
      </div>
    `;
  }

  /**
   * Destroy manager and current experiment
   */
  destroy() {
    if (this.currentInstance) {
      this.currentInstance.destroy();
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
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