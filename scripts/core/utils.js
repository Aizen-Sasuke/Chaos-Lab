/**
 * CHAOS LAB — Utility Functions
 * Math helpers, RAF management, easing, DOM utilities
 */

// ========================================
// Math Helpers
// ========================================

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const lerp = (start, end, factor) => start + (end - start) * factor;

export const mapRange = (value, inMin, inMax, outMin, outMax) =>
  outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);

export const random = (min, max) => Math.random() * (max - min) + min;

export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const degToRad = (deg) => deg * (Math.PI / 180);

export const radToDeg = (rad) => rad * (180 / Math.PI);

export const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

export const angle = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

// ========================================
// Easing Functions
// ========================================

export const ease = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: t => t * t * t,
  easeOutCubic: t => (--t) * t * t + 1,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: t => t * t * t * t,
  easeOutQuart: t => 1 - (--t) * t * t * t,
  easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  easeInExpo: t => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2,
  easeInCirc: t => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: t => Math.sqrt(1 - (t - 1) * (t - 1)),
  easeInOutCirc: t => t < 0.5
    ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
    : (Math.sqrt(1 - 4 * (t - 1) * (t - 1)) + 1) / 2,
  easeInBack: t => t * t * (2.70158 * t - 1.70158),
  easeOutBack: t => 1 + (--t) * t * (2.70158 * t + 1.70158),
  easeInOutBack: t => t < 0.5
    ? (2 * t) * (2 * t) * (3.5949095 * 2 * t - 2.5949095) / 2
    : 1 + (2 * t - 2) * (2 * t - 2) * (3.5949095 * (2 * t - 2) + 2.5949095) / 2,
  elasticOut: t => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  spring: (t, tension = 170, friction = 26) => {
    // Approximation of spring physics
    return 1 - Math.exp(-t * friction / 100) * Math.cos(t * tension / 100);
  }
};

// ========================================
// Color Utilities
// ========================================

export const hexToRgb = (hex) => {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
};

export const hslToRgb = (h, s, l) => {
  h /= 360;
  s /= 100;
  l /= 100;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

export const rgbToCss = (r, g, b, a = 1) =>
  a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;

export const hslToCss = (h, s, l, a = 1) =>
  a === 1 ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${a})`;

export const randomColor = (hueRange = [0, 360], satRange = [50, 80], lightRange = [40, 70]) =>
  hslToCss(random(...hueRange), random(...satRange), random(...lightRange));

export const accentColors = [
  '#00ffc8', // cyan
  '#ff2a6d', // pink
  '#ffd700', // gold
  '#7c4dff', // purple
  '#ff6d00', // orange
  '#00e676', // green
];

export const getRandomAccent = () => randomChoice(accentColors);

// ========================================
// Canvas Utilities
// ========================================

export const resizeCanvas = (canvas, multiplier = 1) => {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(rect.width * dpr * multiplier);
  const height = Math.floor(rect.height * dpr * multiplier);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
};

export const clearCanvas = (ctx, canvas, color = 'transparent') => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (color !== 'transparent') {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();
};

export const drawCircle = (ctx, x, y, radius, fillStyle, strokeStyle, lineWidth) => {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth || 1;
    ctx.stroke();
  }
};

export const drawRect = (ctx, x, y, width, height, fillStyle, strokeStyle, lineWidth) => {
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, y, width, height);
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth || 1;
    ctx.strokeRect(x, y, width, height);
  }
};

export const drawText = (ctx, text, x, y, options = {}) => {
  const {
    font = '16px Space Grotesk',
    fillStyle = '#fff',
    strokeStyle = null,
    lineWidth = 2,
    textAlign = 'center',
    textBaseline = 'middle',
    maxWidth
  } = options;

  ctx.font = font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = textAlign;
  ctx.textBaseline = textBaseline;

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.strokeText(text, x, y, maxWidth);
  }
  ctx.fillText(text, x, y, maxWidth);
};

// ========================================
// RAF Loop Manager
// ========================================

export class RAFLoop {
  constructor(updateFn, options = {}) {
    this.updateFn = updateFn;
    this.running = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.fixedTimestep = options.fixedTimestep || (1000 / 60); // 60 FPS target
    this.maxSubSteps = options.maxSubSteps || 5;
    this.onFrame = options.onFrame || null;
    this.frameId = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  tick = (currentTime) => {
    if (!this.running) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Cap delta time to prevent spiral of death
    const cappedDelta = Math.min(deltaTime, 250);

    this.accumulator += cappedDelta;

    // Fixed timestep updates
    let subSteps = 0;
    while (this.accumulator >= this.fixedTimestep && subSteps < this.maxSubSteps) {
      this.updateFn(this.fixedTimestep / 1000); // Convert to seconds
      this.accumulator -= this.fixedTimestep;
      subSteps++;
    }

    // Render with interpolation
    const alpha = this.accumulator / this.fixedTimestep;
    if (this.onFrame) {
      this.onFrame(alpha, cappedDelta / 1000);
    }

    this.frameId = requestAnimationFrame(this.tick);
  };
}

// ========================================
// Performance Monitor
// ========================================

export class PerformanceMonitor {
  constructor() {
    this.frames = [];
    this.lastTime = performance.now();
    this.fps = 60;
    this.frameCount = 0;
  }

  tick() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.frames.push(now);
    // Keep last 1 second of frames
    const cutoff = now - 1000;
    while (this.frames.length > 0 && this.frames[0] < cutoff) {
      this.frames.shift();
    }

    this.fps = Math.round(this.frames.length * 1000 / (now - (this.frames[0] || now)));
    this.frameCount++;

    return this.fps;
  }

  getFPS() {
    return this.fps;
  }

  reset() {
    this.frames = [];
    this.lastTime = performance.now();
    this.fps = 60;
    this.frameCount = 0;
  }
}

// ========================================
// DOM Utilities
// ========================================

export const $ = (selector, parent = document) => parent.querySelector(selector);

export const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

export const createElement = (tag, options = {}) => {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.id) el.id = options.id;
  if (options.text) el.textContent = options.text;
  if (options.html) el.innerHTML = options.html;
  if (options.attrs) Object.entries(options.attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (options.style) Object.assign(el.style, options.style);
  if (options.parent) options.parent.appendChild(el);
  if (options.listeners) {
    Object.entries(options.listeners).forEach(([event, handler]) => {
      el.addEventListener(event, handler);
    });
  }
  return el;
};

export const removeElement = (el) => {
  if (el && el.parentNode) el.parentNode.removeChild(el);
};

export const setStyle = (el, styles) => Object.assign(el.style, styles);

export const on = (el, event, handler, options) => {
  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
};

export const once = (el, event, handler, options) => {
  const wrapped = (...args) => {
    el.removeEventListener(event, wrapped, options);
    handler(...args);
  };
  el.addEventListener(event, wrapped, options);
  return () => el.removeEventListener(event, wrapped, options);
};

// ========================================
// Event Emitter (lightweight)
// ========================================

export class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  on(event, handler) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.events.get(event);
    if (handlers) handlers.delete(handler);
  }

  emit(event, ...args) {
    const handlers = this.events.get(event);
    if (handlers) handlers.forEach(h => h(...args));
  }

  once(event, handler) {
    const wrapped = (...args) => {
      this.off(event, wrapped);
      handler(...args);
    };
    this.on(event, wrapped);
  }

  clear(event) {
    if (event) this.events.delete(event);
    else this.events.clear();
  }
}

// ========================================
// Debounce / Throttle
// ========================================

export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = (fn, limit) => {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// ========================================
// Device/Feature Detection
// ========================================

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const prefersHighContrast = () =>
  window.matchMedia('(prefers-contrast: high)').matches;

export const isTouchDevice = () =>
  'ontouchstart' in window || navigator.maxTouchPoints > 0;

export const getDPR = () => window.devicePixelRatio || 1;

// ========================================
// Unique ID Generator
// ========================================

let idCounter = 0;
export const uid = (prefix = '') => `${prefix}${++idCounter}_${Math.random().toString(36).slice(2, 9)}`;

// ========================================
// Storage Helper
// ========================================

export const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch { return defaultValue; }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch { return false; }
  }
};