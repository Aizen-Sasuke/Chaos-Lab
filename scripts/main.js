/**
 * CHAOS LAB — Main Entry Point
 * Initializes the experiment manager and loads all experiments
 */

import { ExperimentManager } from './core/ExperimentManager.js';
import { AmbientBackground } from './core/AmbientBackground.js';
import { CursorGravityExperiment } from './experiments/cursor-gravity.js';
import { CursedButtonExperiment } from './experiments/cursed-button.js';
import { NameParticlesExperiment } from './experiments/name-particles.js';

// ========================================
// DOM Elements
// ========================================

const viewport = document.getElementById('viewport');
const switcher = document.getElementById('switcher');
const fpsEl = document.getElementById('fps');
const particleCountEl = document.getElementById('particle-count');

// ========================================
// Experiment Manager
// ========================================

const manager = new ExperimentManager({
  viewport,
  switcher
});

// Register experiments
manager.register('cursor-gravity', CursorGravityExperiment, {
  name: 'Cursor Gravity',
  icon: '🌀',
  description: 'Particles orbit your cursor'
});

manager.register('cursed-button', CursedButtonExperiment, {
  name: 'Cursed Button',
  icon: '🎯',
  description: 'A button that fights back'
});

manager.register('name-particles', NameParticlesExperiment, {
  name: 'Name Particles',
  icon: '✨',
  description: 'Type your name, watch it explode'
});

// ========================================
// Stats Update Loop
// ========================================

let lastStatsUpdate = 0;
function updateStats(time) {
  if (time - lastStatsUpdate > 500) { // Update twice per second
    const current = manager.getCurrent();
    if (current) {
      const stats = current.getStats();
      if (fpsEl) fpsEl.textContent = stats.fps;
      // Single writer for the counter. Experiments expose the number instead
      // of writing to the DOM themselves.
      if (particleCountEl) particleCountEl.textContent = stats.particleCount ?? 0;
    }
    lastStatsUpdate = time;
  }
  requestAnimationFrame(updateStats);
}

// ========================================
// Error Handling
// ========================================

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
});

// ========================================
// Initialize
// ========================================

let ambientBg = null;

async function init() {
  try {
    // Initialize ambient background
    const bgCanvas = document.getElementById('bg-canvas');
    if (bgCanvas) {
      ambientBg = new AmbientBackground(bgCanvas);
      ambientBg.init();
    }

    // Show loading state
    viewport.innerHTML = `
      <div class="experiment-loading">
        Initializing CHAOS LAB...
      </div>
    `;

    await manager.init('cursor-gravity');

    // Start stats loop
    requestAnimationFrame(updateStats);

    // Announce ready
    console.log('%c🧪 CHAOS LAB INITIALIZED', 'font-size: 20px; color: #00ffc8; font-weight: bold;');
    console.log('%cExperiments loaded:', 'color: #8888a0;', manager.getAll().map(e => e.id).join(', '));
    console.log('%cPress 1, 2, 3 to switch experiments. Space to pause.', 'color: #55556a;');

  } catch (error) {
    console.error('Failed to initialize CHAOS LAB:', error);
    viewport.innerHTML = `
      <div class="experiment-error">
        <h3>Initialization Failed</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()">Reload</button>
      </div>
    `;
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.CHAOS_LAB = {
  manager,
  get ambientBg() { return ambientBg; },
  switchTo: (id) => manager.switchTo(id),
  getCurrent: () => manager.getCurrent(),
  pause: () => manager.getCurrent()?.pause(),
  resume: () => manager.getCurrent()?.resume()
};