// Animated "neural network / world grid" background.
//
// Layers (back to front) — only the network canvas is redrawn per frame:
//   1. static canvas (#bg-canvas)  — deep gradient + coordinate grid + crosshairs + labels
//                                    (redrawn only on resize / 0.025 tension steps)
//   2. network canvas (.fx-bg-net) — transparent; drifting nodes, links, data pulses, hub pings,
//                                    scan line, high-tension flicker
//   3. .fx-bg-overlay (CSS)        — vignette + scanlines, composited by the browser
//   4. .fx-bg-alarm (CSS)          — red edge glow; JS only animates its opacity (heartbeat)
//
// Performance: backing stores are capped by area (MAX_LAYER_PIXELS), frames are throttled to
// 30 fps while tension is low, and a governor steps quality down (DPR, node count, glows)
// when frames stay slow.
//
// Tension (0..1) is eased continuously. It drives speed, pulse rate, chain length and the palette.
// Heat spreads spatially from a slowly wandering "epicenter": calm cyan → pale steel → amber → red.

import { clamp, lerp, rand, rampColor, rgba, smoothstep, type RGB } from './util';
import { isReducedMotion, onMotionChange } from './motion';

interface NetNode {
  x: number; y: number;
  home: number;         // cluster index, −1 = free drifting node
  ox: number; oy: number; // offset from the cluster center
  ang: number;          // heading (radians)
  spd: number;          // base speed px/s
  wf: number;           // wander frequency
  phase: number;
  z: number;            // depth 0.35..1 (alpha / size / speed)
  r: number;            // core radius
  seed: number;         // per-node randomness for heat threshold
  hub: boolean;
  heat: number;         // 0..1 smoothed
  ping: number;         // hub ping progress (−1 = idle)
  nextPing: number;     // seconds until next ping
}

interface Pulse { a: number; b: number; p: number; speed: number; hops: number }

/** A slowly orbiting constellation center. */
interface Cluster { ax: number; ay: number; rx: number; ry: number; fx: number; fy: number; px: number; py: number; x: number; y: number }

/** Node / link color by heat. The pale-steel midpoint avoids a muddy cyan→amber blend. */
const HEAT_RAMP: ReadonlyArray<readonly [number, RGB]> = [
  [0.0, [63, 208, 255]],
  [0.22, [96, 200, 255]],
  [0.34, [196, 206, 216]],
  [0.46, [255, 188, 92]],
  [0.72, [255, 128, 64]],
  [1.0, [255, 58, 80]],
];
/** Global tint (grid, scan band, background glow) by tension. */
const GLOBAL_RAMP: ReadonlyArray<readonly [number, RGB]> = [
  [0.0, [63, 170, 255]],
  [0.3, [110, 165, 215]],
  [0.5, [235, 165, 90]],
  [0.75, [255, 120, 70]],
  [1.0, [255, 64, 84]],
];
const BG_CENTER: ReadonlyArray<readonly [number, RGB]> = [
  [0.0, [12, 26, 48]],
  [0.5, [32, 23, 14]],
  [1.0, [42, 10, 18]],
];
const BG_EDGE: RGB = [5, 8, 15];

const HEAT_BUCKETS = 12;
/** Pre-computed node colors per heat bucket (avoids per-frame allocations). */
const HEAT_COLORS: RGB[] = Array.from({ length: HEAT_BUCKETS }, (_, i) => rampColor(HEAT_RAMP, i / (HEAT_BUCKETS - 1)));
const HEAT_CSS: string[] = HEAT_COLORS.map((c) => rgba(c, 1));
const ALPHA_BUCKETS = 5;
const TAU_TENSION = 1.2; // seconds
/** Max backing-store pixels per canvas layer (1440×900 → DPR 1.24). */
const MAX_LAYER_PIXELS = 2.0e6;
const FPS_LOW = 1000 / 30;
const FPS_HIGH = 1000 / 60;

export class NeuralBackground {
  private canvas: HTMLCanvasElement;          // static layer (the page's #bg-canvas)
  private sctx: CanvasRenderingContext2D;
  private net: HTMLCanvasElement;             // animated network layer
  private ctx: CanvasRenderingContext2D;
  private overlayEl: HTMLDivElement;
  private alarmEl: HTMLDivElement;
  private alarmOpacity = -1;
  private w = 0; private h = 0; private dpr = 1;
  private popW = 0; private popH = 0;   // viewport size the network was generated for
  private margin = 120;
  private linkDist = 160;
  private nodes: NetNode[] = [];
  private clusters: Cluster[] = [];
  private pulses: Pulse[] = [];
  private phaseTime = 0;        // animation time, advances faster with tension
  private tension = 0;
  private target = 0;
  private time = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private lowPower = false;
  private spawnAcc = 0;
  private epi = { x: 0.3, y: 0.4 };
  private flicker = 0;          // remaining seconds of current flicker event
  private staticT = -1;
  // Adaptive quality governor
  private quality = 0;          // 0 full · 1 DPR≤1 + 30 fps · 2 DPR 0.75, fewer nodes, cheap glows
  private lastTick = 0;         // previous rAF callback (rendered or skipped)
  private slowTicks = 0;
  private evalTicks = 0;
  private costEMA = 0;          // our update+draw JS time per rendered frame (ms)
  private renderEMA = 0;        // browser paint/raster/commit after our frame (ms), see probeRender()
  private probe: MessageChannel | null = null;
  private warmup = 10;
  private sprites = new Map<number, HTMLCanvasElement>();
  private buckets: number[][] = [];
  private unsubMotion: (() => void) | null = null;
  private resizeQueued = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const sctx = canvas.getContext('2d', { alpha: false });
    this.net = document.createElement('canvas');
    this.net.className = 'fx-bg-net';
    const ctx = this.net.getContext('2d');
    if (!sctx || !ctx) throw new Error('2d context unavailable');
    this.sctx = sctx;
    this.ctx = ctx;
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'fx-bg-overlay';
    this.alarmEl = document.createElement('div');
    this.alarmEl.className = 'fx-bg-alarm';
    for (const el of [this.net, this.overlayEl, this.alarmEl]) el.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < HEAT_BUCKETS * ALPHA_BUCKETS; i++) this.buckets.push([]);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lowPower = isLowPowerDevice();
    if (typeof MessageChannel !== 'undefined') {
      this.probe = new MessageChannel();
      this.probe.port1.onmessage = (e: MessageEvent<number>) => {
        this.renderEMA += (performance.now() - e.data - this.renderEMA) * 0.1;
      };
    }
    // Layer the animated canvas + CSS overlays directly above the static canvas.
    if (this.canvas.parentNode) this.canvas.after(this.net, this.overlayEl, this.alarmEl);
    else document.body.prepend(this.net, this.overlayEl, this.alarmEl);
    this.resize();
    window.addEventListener('resize', this.onResize, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.unsubMotion = onMotionChange(() => this.kick());
    this.kick();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.unsubMotion?.();
    this.unsubMotion = null;
    if (this.probe) { this.probe.port1.onmessage = null; this.probe.port1.close(); this.probe.port2.close(); this.probe = null; }
    this.net.remove();
    this.overlayEl.remove();
    this.alarmEl.remove();
    this.sctx.setTransform(1, 0, 0, 1, 0, 0);
    this.sctx.fillStyle = '#070b14';
    this.sctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setTension(t: number): void {
    this.target = clamp(Number.isFinite(t) ? t : 0);
    if (isReducedMotion()) {
      this.tension = this.target;
      this.renderStill();
    }
  }

  /** Diagnostics for the dev bench / perf scripts. */
  debug(): { quality: number; dpr: number; nodes: number; costMs: number; renderMs: number; fpsTarget: number } {
    return {
      quality: this.quality, dpr: Math.round(this.dpr * 100) / 100, nodes: this.nodes.length,
      costMs: Math.round(this.costEMA * 100) / 100, renderMs: Math.round(this.renderEMA * 10) / 10,
      fpsTarget: Math.round(1000 / this.frameInterval()),
    };
  }

  /** Jump straight to the target (used by the dev bench for screenshots). */
  snapTension(): void {
    this.tension = this.target;
    for (const n of this.nodes) n.heat = this.heatTarget(n);
    this.renderStill();
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  private onResize = () => {
    if (this.resizeQueued) return;
    this.resizeQueued = true;
    requestAnimationFrame(() => {
      this.resizeQueued = false;
      if (this.running) { this.resize(); this.renderStill(); }
    });
  };

  private onVisibility = () => {
    if (!this.running) return;
    if (document.hidden) { cancelAnimationFrame(this.raf); this.raf = 0; }
    else this.kick();
  };

  /** (Re)start the frame loop, or draw a single still frame under reduced motion. */
  private kick(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (!this.running) return;
    if (isReducedMotion()) { this.tension = this.target; this.renderStill(); return; }
    if (document.hidden) return;
    this.last = this.lastTick = performance.now();
    this.warmup = 10;
    this.raf = requestAnimationFrame(this.frame);
  }

  /** 30 fps while calm (motion is slow), 60 fps when tension makes things move fast. */
  private frameInterval(): number {
    return this.lowPower || this.quality > 0 || this.tension < 0.5 ? FPS_LOW : FPS_HIGH;
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    this.govern(now - this.lastTick);
    this.lastTick = now;
    const elapsed = now - this.last;
    if (elapsed < this.frameInterval() - 4) return; // tolerance so 30 fps lands on every other 60 Hz vsync
    this.last = now;
    const dt = Math.min(elapsed / 1000, 0.05);
    const t0 = performance.now();
    this.update(dt);
    this.draw();
    const end = performance.now();
    this.costEMA += (end - t0 - this.costEMA) * 0.1;
    this.probeRender(end);
  };

  /**
   * A message posted from inside the rAF callback is delivered as the next task — after the
   * browser has painted/rasterized/committed this frame — so its delay approximates the
   * rendering cost our frame caused (canvas raster is the dominant part on large screens).
   */
  private probeRender(end: number): void {
    if (this.warmup > 0 || !this.probe) return;
    this.probe.port2.postMessage(end);
  }

  /**
   * Quality governor. Steps quality down when, over a ~40-tick window, either
   *  • the rAF cadence is mostly > 20 ms (main thread saturated by us and/or the UI), or
   *  • a rendered frame costs > 20 ms in total (our JS + the paint/raster it triggers) — this
   *    catches a busy-but-still-on-time main thread that the cadence alone would miss.
   * Using a share / EMA (not single samples) ignores one-off spikes. Never steps back up.
   */
  private govern(gap: number): void {
    if (this.warmup > 0) { this.warmup--; return; }
    if (gap > (this.lowPower ? 40 : 20)) this.slowTicks++;
    if (++this.evalTicks < 40) return;
    const slowShare = this.slowTicks / this.evalTicks;
    this.evalTicks = 0;
    this.slowTicks = 0;
    const frameCost = this.costEMA + this.renderEMA;
    if (this.quality < 2 && (slowShare > 0.6 || frameCost > 20)) this.setQuality(this.quality + 1);
  }

  private setQuality(q: number): void {
    this.quality = Math.min(2, q);
    this.net.dataset.quality = String(this.quality); // visible in devtools / perf scripts
    if (this.quality >= 2) {
      // Keep 60 % of the nodes (O(n²) links drop ~64 %); pulses reference indices, so reset them.
      this.nodes = this.nodes.filter((_, i) => i % 5 < 3);
      this.pulses.length = 0;
    }
    this.warmup = 10;
    this.evalTicks = 0;
    this.slowTicks = 0;
    this.renderEMA = 0;
    this.resize(true);
  }

  private renderStill(): void {
    if (!this.running) return;
    for (const n of this.nodes) n.heat = this.heatTarget(n);
    this.pulses.length = 0;
    this.flicker = 0;
    this.draw();
  }

  /** Device-pixel ratio for the layers: capped by device class, by area and by quality level. */
  private layerDpr(w: number, h: number): number {
    const device = window.devicePixelRatio || 1;
    let dpr = Math.min(device, this.lowPower ? 1.5 : 2, Math.max(1, Math.sqrt(MAX_LAYER_PIXELS / (w * h))));
    if (this.quality >= 1) dpr = Math.min(dpr, 1);
    if (this.quality >= 2) dpr = Math.min(dpr, 0.75);
    return dpr;
  }

  private resize(force = false): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const dpr = this.layerDpr(w, h);
    const changed = w !== this.w || h !== this.h || dpr !== this.dpr;
    this.w = w; this.h = h; this.dpr = dpr;
    if (!changed && !force && this.nodes.length) return;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    for (const c of [this.canvas, this.net]) { c.width = W; c.height = H; }
    const prevArea = this.popW * this.popH;
    const areaChange = prevArea ? Math.abs(w * h - prevArea) / prevArea : 1;
    // Small changes (mobile URL bar show/hide) keep the existing network so nothing jumps.
    if (!this.nodes.length || areaChange > 0.3 || Math.abs(w - this.popW) > 80) {
      this.linkDist = clamp(Math.min(w, h) * 0.2, 120, 170);
      this.margin = this.linkDist;
      this.popW = w; this.popH = h;
      this.populate();
    }
    this.staticT = -1;
    this.alarmOpacity = -1;
  }

  private populate(): void {
    const m = this.margin;
    const W = this.w + 2 * m, H = this.h + 2 * m;
    const area = W * H;
    const cap = this.lowPower ? 80 : this.quality >= 2 ? 100 : 170;
    // Constellations: dense clusters orbiting slow anchors, bridged by free-drifting nodes.
    const nClusters = Math.round(clamp(area / 230000, 4, 8));
    this.clusters = [];
    // Spread anchors on a jittered grid over the *visible* area so clusters don't pile up
    // (or hide in the off-screen margin on narrow phones).
    const cols = Math.max(1, Math.round(Math.sqrt(nClusters * (this.w / this.h))));
    const rows = Math.ceil(nClusters / cols);
    const order = Array.from({ length: cols * rows }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (let i = 0; i < nClusters; i++) {
      const cell = order[i];
      const cx = ((cell % cols) + rand(0.2, 0.8)) / cols;
      const cy = (Math.floor(cell / cols) + rand(0.2, 0.8)) / rows;
      this.clusters.push({
        ax: cx * this.w, ay: cy * this.h,
        rx: rand(40, 110), ry: rand(30, 90),
        fx: rand(0.01, 0.025), fy: rand(0.012, 0.03),
        px: rand(0, 6.3), py: rand(0, 6.3), x: 0, y: 0,
      });
    }
    const perNode = this.lowPower ? 10000 : 9500;
    const count = Math.round(clamp(area / perNode, 30, cap));
    const clustered = Math.round(count * 0.52);
    const nodes: NetNode[] = [];
    for (let i = 0; i < count; i++) {
      const z = rand(0.35, 1);
      const hub = Math.random() < 0.07;
      const home = i < clustered ? i % nClusters : -1;
      // Gaussian-ish offset (sum of uniforms) around the cluster center.
      const sigma = rand(55, 95);
      const ox = (Math.random() + Math.random() + Math.random() - 1.5) * sigma * 1.4;
      const oy = (Math.random() + Math.random() + Math.random() - 1.5) * sigma * 1.1;
      nodes.push({
        x: rand(-m, this.w + m), y: rand(-m, this.h + m),
        home, ox, oy,
        ang: rand(0, Math.PI * 2),
        spd: rand(5, 13),
        wf: rand(0.05, 0.22),
        phase: rand(0, 100),
        z,
        r: hub ? rand(2.1, 2.9) : rand(0.8, 1.7) * (0.6 + 0.4 * z),
        seed: Math.random(),
        hub,
        heat: 0,
        ping: -1,
        nextPing: rand(2, 9),
      });
    }
    this.nodes = nodes;
    this.pulses.length = 0;
    this.placeClustered(0);
    for (const n of nodes) n.heat = this.heatTarget(n);
  }

  /** Clustered nodes: center (orbiting anchor) + fixed offset + a small local wobble. */
  private placeClustered(dt: number): void {
    const pt = this.phaseTime;
    for (const c of this.clusters) {
      c.x = c.ax + c.rx * Math.sin(pt * c.fx + c.px);
      c.y = c.ay + c.ry * Math.sin(pt * c.fy + c.py);
    }
    const wob = 16;
    for (const n of this.nodes) {
      if (n.home < 0) continue;
      const c = this.clusters[n.home];
      const tx = c.x + n.ox + wob * Math.sin(pt * n.wf * 2.2 + n.phase);
      const ty = c.y + n.oy + wob * Math.cos(pt * n.wf * 1.7 + n.phase * 1.3);
      if (dt <= 0) { n.x = tx; n.y = ty; }
      else { const k = 1 - Math.exp(-dt * 3); n.x += (tx - n.x) * k; n.y += (ty - n.y) * k; }
    }
  }

  // ───────────────────────────── simulation ─────────────────────────────

  private heatTarget(n: NetNode): number {
    const dx = (n.x / this.w - this.epi.x) * (this.w / Math.max(this.w, this.h));
    const dy = (n.y / this.h - this.epi.y) * (this.h / Math.max(this.w, this.h));
    const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.25);
    const u = 0.7 * d + 0.3 * n.seed;
    return clamp(2 * this.tension - 0.8 * u);
  }

  private update(dt: number): void {
    this.time += dt;
    const t = (this.tension += (this.target - this.tension) * (1 - Math.exp(-dt / TAU_TENSION)));
    const speedMul = lerp(1, 2.9, t * t);
    const jitter = smoothstep(0.75, 1, t) * 14;
    const m = this.margin, W = this.w + m, H = this.h + m;

    // Epicenter wanders on a slow Lissajous path.
    this.epi.x = 0.5 + 0.28 * Math.sin(this.time * 0.021 + 1.3);
    this.epi.y = 0.45 + 0.22 * Math.sin(this.time * 0.029 + 0.4);

    const heatK = 1 - Math.exp(-dt / 0.9);
    this.phaseTime += dt * speedMul;
    this.placeClustered(dt);
    for (const n of this.nodes) {
      if (n.home < 0) {
        n.ang += Math.sin(this.time * n.wf + n.phase) * dt * 0.7;
        const v = n.spd * speedMul * (0.55 + 0.45 * n.z);
        n.x += Math.cos(n.ang) * v * dt;
        n.y += Math.sin(n.ang) * v * dt;
        if (n.x < -m) n.x += W + m; else if (n.x > W) n.x -= W + m;
        if (n.y < -m) n.y += H + m; else if (n.y > H) n.y -= H + m;
      }
      if (jitter > 0 && Math.random() < 0.08) { n.x += rand(-1, 1) * jitter * dt; n.y += rand(-1, 1) * jitter * dt; }
      n.heat += (this.heatTarget(n) - n.heat) * heatK;
      if (n.hub) {
        if (n.ping >= 0) { n.ping += dt / lerp(2.2, 1.1, t); if (n.ping >= 1) n.ping = -1; }
        else if ((n.nextPing -= dt * lerp(1, 2.5, t)) <= 0) { n.ping = 0; n.nextPing = rand(4, 11); }
      }
    }

    // Data pulses: spawn rate, speed and cascade length all grow with tension.
    this.spawnAcc += dt * lerp(0.7, 5.5, Math.pow(t, 1.3)) * (this.lowPower ? 0.7 : 1);
    while (this.spawnAcc >= 1) { this.spawnAcc -= 1; this.spawnPulse(-1, 0); }
    const maxHops = Math.round(lerp(2, 7, t));
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      const a = this.nodes[p.a], b = this.nodes[p.b];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      p.p += (p.speed * dt) / len;
      if (len > this.linkDist * 1.25) { this.pulses.splice(i, 1); continue; } // link broke
      if (p.p >= 1) {
        this.pulses.splice(i, 1);
        if (p.hops < maxHops && Math.random() < lerp(0.45, 0.85, t)) this.spawnPulse(p.b, p.hops + 1, p.a);
      }
    }

    // Flicker events at high tension.
    if (this.flicker > 0) this.flicker -= dt;
    else if (Math.random() < dt * smoothstep(0.68, 1, t) * 0.45) this.flicker = rand(0.07, 0.2);
  }

  private spawnPulse(from: number, hops: number, exclude = -1): void {
    if (this.pulses.length > (this.lowPower ? 24 : 48)) return;
    const nodes = this.nodes;
    const a = from >= 0 ? from : (Math.random() * nodes.length) | 0;
    const na = nodes[a];
    if (!na) return;
    const L2 = this.linkDist * this.linkDist * 0.8;
    const cand: number[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (j === a || j === exclude) continue;
      const dx = nodes[j].x - na.x, dy = nodes[j].y - na.y;
      if (dx * dx + dy * dy < L2) cand.push(j);
    }
    if (!cand.length) return;
    const b = cand[(Math.random() * cand.length) | 0];
    this.pulses.push({ a, b, p: 0, hops, speed: lerp(120, 360, this.tension) * rand(0.8, 1.2) });
  }

  // ───────────────────────────── rendering ─────────────────────────────

  private draw(): void {
    const { ctx, dpr } = this;
    const t = this.tension;
    if (this.staticT < 0 || Math.abs(t - this.staticT) > 0.025) this.buildStatic();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.net.width, this.net.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.drawLinks();
    ctx.globalCompositeOperation = 'lighter';
    this.drawPulses();
    this.drawNodes();
    if (!isReducedMotion()) this.drawScanBand();
    ctx.globalCompositeOperation = 'source-over';

    // Alarm edge glow is a CSS layer: only its opacity changes (compositor-only).
    const alarm = smoothstep(0.5, 1, t);
    const beat = isReducedMotion() ? 0.5 : heartbeat(this.time, lerp(1.5, 0.8, t));
    const op = alarm > 0.01 ? alarm * (0.45 + 0.55 * beat) : 0;
    if (Math.abs(op - this.alarmOpacity) > 0.004) {
      this.alarmOpacity = op;
      this.alarmEl.style.opacity = op.toFixed(3);
    }
    if (this.flicker > 0) this.drawFlicker();
  }

  private drawLinks(): void {
    const { ctx, nodes, buckets } = this;
    const L = this.linkDist, L2 = L * L;
    const t = this.tension;
    const baseAlpha = lerp(0.5, 0.62, t);
    for (const b of buckets) b.length = 0;
    const n = nodes.length;
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        const dx = b.x - a.x; if (dx > L || dx < -L) continue;
        const dy = b.y - a.y; if (dy > L || dy < -L) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 > L2) continue;
        const f = 1 - Math.sqrt(d2) / L;
        const alpha = Math.pow(f, 1.4) * Math.min(a.z, b.z);
        if (alpha < 0.04) continue;
        const hb = Math.min(HEAT_BUCKETS - 1, Math.round(((a.heat + b.heat) / 2) * (HEAT_BUCKETS - 1)));
        const ab = Math.min(ALPHA_BUCKETS - 1, (alpha * ALPHA_BUCKETS) | 0);
        buckets[hb * ALPHA_BUCKETS + ab].push(a.x, a.y, b.x, b.y);
      }
    }
    ctx.lineWidth = 0.9;
    for (let hb = 0; hb < HEAT_BUCKETS; hb++) {
      const col = HEAT_COLORS[hb];
      for (let ab = 0; ab < ALPHA_BUCKETS; ab++) {
        const seg = buckets[hb * ALPHA_BUCKETS + ab];
        if (!seg.length) continue;
        ctx.strokeStyle = rgba(col, ((ab + 0.5) / ALPHA_BUCKETS) * baseAlpha);
        ctx.beginPath();
        for (let k = 0; k < seg.length; k += 4) { ctx.moveTo(seg[k], seg[k + 1]); ctx.lineTo(seg[k + 2], seg[k + 3]); }
        ctx.stroke();
      }
    }
  }

  private drawNodes(): void {
    const { ctx } = this;
    const t = this.tension;
    for (const n of this.nodes) {
      if (n.x < -20 || n.y < -20 || n.x > this.w + 20 || n.y > this.h + 20) continue;
      const hb = Math.round(n.heat * (HEAT_BUCKETS - 1));
      const css = HEAT_CSS[hb];
      const twinkle = 0.75 + 0.25 * Math.sin(this.time * 1.7 + n.phase * 3);
      // Soft glow (hubs only at the lowest quality level)
      if (n.hub || this.quality < 2) {
        const g = n.hub ? 30 : 11 + 6 * n.z;
        ctx.globalAlpha = (n.hub ? 0.55 : 0.32) * n.z * twinkle * (0.85 + 0.3 * n.heat);
        ctx.drawImage(this.sprite(hb), n.x - g / 2, n.y - g / 2, g, g);
      }
      // Core
      ctx.globalAlpha = (0.55 + 0.45 * n.z) * twinkle;
      ctx.fillStyle = css;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
      if (n.hub) {
        ctx.globalAlpha = 0.28 * n.z;
        ctx.strokeStyle = css;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 7, 0, Math.PI * 2);
        ctx.stroke();
        if (n.ping >= 0) {
          const e = n.ping;
          ctx.globalAlpha = (1 - e) * (1 - e) * lerp(0.45, 0.7, t) * n.z;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 7 + e * lerp(46, 70, t), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawPulses(): void {
    const { ctx } = this;
    for (const p of this.pulses) {
      const a = this.nodes[p.a], b = this.nodes[p.b];
      const e = p.p;
      const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
      const tail = Math.max(0, e - 0.35);
      const tx = a.x + (b.x - a.x) * tail, ty = a.y + (b.y - a.y) * tail;
      const heat = Math.max(a.heat, b.heat);
      const hb = Math.round(heat * (HEAT_BUCKETS - 1));
      const col = HEAT_COLORS[hb];
      const fade = Math.min(1, e * 6, (1 - e) * 6);
      const grad = ctx.createLinearGradient(tx, ty, x, y);
      grad.addColorStop(0, rgba(col, 0));
      grad.addColorStop(1, rgba(col, 0.85 * fade));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.drawImage(this.sprite(hb), x - 9, y - 9, 18, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
      ctx.globalAlpha = 1;
    }
  }

  private drawScanBand(): void {
    const { ctx } = this;
    const t = this.tension;
    const period = lerp(14, 7, t);
    const bandH = 44;
    const y = ((this.time / period) % 1) * (this.h + bandH * 2) - bandH;
    const col = rampColor(GLOBAL_RAMP, t);
    // Thin, faint scanner line with a short soft tail (no visible slab or seam).
    const grad = ctx.createLinearGradient(0, y, 0, y + bandH);
    grad.addColorStop(0, rgba(col, 0));
    grad.addColorStop(0.85, rgba(col, lerp(0.018, 0.03, t)));
    grad.addColorStop(0.96, rgba(col, lerp(0.05, 0.08, t)));
    grad.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, this.w, bandH);
  }

  private drawFlicker(): void {
    const { ctx, net: canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const slices = 1 + ((Math.random() * 3) | 0);
    for (let i = 0; i < slices; i++) {
      const sh = Math.round(rand(8, 60) * this.dpr);
      const sy = Math.round(rand(0, H - sh));
      const dx = Math.round(rand(-28, 28) * this.dpr);
      ctx.drawImage(canvas, 0, sy, W, sh, dx, sy, W, sh);
    }
    // Brightness dip: a translucent black wash on the top layer darkens the whole composite.
    ctx.fillStyle = `rgba(0,0,0,${rand(0.08, 0.3).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    if (Math.random() < 0.5) {
      ctx.fillStyle = 'rgba(255,60,80,0.18)';
      ctx.fillRect(0, Math.round(rand(0, H)), W, Math.max(1, Math.round(this.dpr)));
    }
  }

  // ───────────────────────────── cached layers ─────────────────────────────

  private sprite(heatBucket: number): HTMLCanvasElement {
    let s = this.sprites.get(heatBucket);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d')!;
    const col = HEAT_COLORS[heatBucket];
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(col, 0.9));
    grad.addColorStop(0.18, rgba(col, 0.42));
    grad.addColorStop(0.5, rgba(col, 0.08));
    grad.addColorStop(1, rgba(col, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.sprites.set(heatBucket, s);
    return s;
  }

  private buildStatic(): void {
    const t = this.tension;
    this.staticT = t;
    const c = this.canvas, g = this.sctx;
    const W = c.width, H = c.height, dpr = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);

    // Deep gradient with a soft glow slightly above center.
    const center = rampColor(BG_CENTER, t);
    g.fillStyle = rgba(BG_EDGE, 1);
    g.fillRect(0, 0, W, H);
    const R = Math.max(W, H) * 0.75;
    const bg = g.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, R);
    bg.addColorStop(0, rgba(center, 1));
    bg.addColorStop(0.55, rgba([(center[0] + 7) / 2 + 2, (center[1] + 11) / 2 + 2, (center[2] + 20) / 2 + 2], 1));
    bg.addColorStop(1, rgba(BG_EDGE, 1));
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Coordinate grid: minor + major lines, crisp on device pixels.
    const tint = rampColor(GLOBAL_RAMP, t);
    const minor = 44 * dpr, major = minor * 5;
    const ox = (W / 2) % major, oy = (H / 2) % major; // center the major grid
    g.lineWidth = 1;
    const lines = (step: number, alpha: number) => {
      g.strokeStyle = rgba(tint, alpha);
      g.beginPath();
      for (let x = ox % step; x < W; x += step) { const px = Math.round(x) + 0.5; g.moveTo(px, 0); g.lineTo(px, H); }
      for (let y = oy % step; y < H; y += step) { const py = Math.round(y) + 0.5; g.moveTo(0, py); g.lineTo(W, py); }
      g.stroke();
    };
    lines(minor, 0.028);
    lines(major, 0.06);

    // Crosshairs at major intersections + tiny coordinate ticks along the left edge.
    const arm = 5 * dpr;
    g.strokeStyle = rgba(tint, 0.2);
    g.beginPath();
    for (let x = ox; x < W; x += major) {
      for (let y = oy; y < H; y += major) {
        const px = Math.round(x) + 0.5, py = Math.round(y) + 0.5;
        g.moveTo(px - arm, py); g.lineTo(px + arm, py);
        g.moveTo(px, py - arm); g.lineTo(px, py + arm);
      }
    }
    g.stroke();
    g.fillStyle = rgba(tint, 0.22);
    g.font = `${Math.round(9 * dpr)}px "JetBrains Mono", ui-monospace, monospace`;
    g.textBaseline = 'bottom';
    let k = 0;
    for (let y = oy; y < H; y += major, k++) {
      const lat = Math.round((0.5 - y / H) * 120);
      g.fillText(`${Math.abs(lat).toString().padStart(2, '0')}°${lat >= 0 ? 'N' : 'S'}`, 6 * dpr, Math.round(y) - 3 * dpr);
    }
    g.textBaseline = 'top';
    for (let x = ox; x < W; x += major) {
      const lon = Math.round((x / W - 0.5) * 220);
      g.fillText(`${Math.abs(lon).toString().padStart(3, '0')}°${lon >= 0 ? 'E' : 'W'}`, Math.round(x) + 4 * dpr, 6 * dpr);
    }
  }
}

/** Double-bump "lub-dub" envelope in 0..1. */
function heartbeat(time: number, period: number): number {
  const ph = (time % period) / period;
  const bump = (c: number, w: number) => Math.exp(-((ph - c) * (ph - c)) / (2 * w * w));
  return Math.min(1, bump(0.08, 0.035) + 0.7 * bump(0.24, 0.04));
}

function isLowPowerDevice(): boolean {
  try {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    const cores = navigator.hardwareConcurrency || 4;
    return (coarse && small) || cores <= 4 && small;
  } catch {
    return false;
  }
}
