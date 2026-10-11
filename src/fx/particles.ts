// Particle bursts (sparks + confetti) on one transient full-viewport canvas in the fx layer.
// The canvas exists only while particles are alive.

import { clamp, fxLayer, mixRGB, rand, resolveColor, rgba, type RGB } from './util';
import { isReducedMotion } from './motion';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  kind: 0 | 1 | 2;         // 0 spark streak, 1 confetti, 2 glow dot
  color: RGB;
  size: number;
  rot: number; vr: number; flip: number;
}

const MAX_PARTICLES = 420;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;
let last = 0;
let dpr = 1;

const DEFAULT_PALETTE: RGB[] = [[63, 208, 255], [232, 193, 105], [236, 230, 216]];

export function burst(x: number, y: number, opts: { color?: string; count?: number; spread?: number } = {}): void {
  if (isReducedMotion()) return;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  ensureCanvas();
  if (!ctx) return;
  const count = Math.round(clamp(opts.count ?? 28, 1, 160));
  const spread = clamp(opts.spread ?? 1, 0.2, 4);
  const palette = opts.color
    ? (() => { const c = resolveColor(opts.color); return [c, mixRGB(c, [255, 255, 255], 0.45), mixRGB(c, [255, 255, 255], 0.8)]; })()
    : DEFAULT_PALETTE;
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const kind = (Math.random() < 0.42 ? 1 : Math.random() < 0.7 ? 0 : 2) as 0 | 1 | 2;
    const ang = rand(0, Math.PI * 2);
    const speed = rand(140, 470) * spread * (kind === 1 ? 0.75 : 1);
    particles.push({
      x, y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - rand(60, 200) * spread,
      life: 0,
      max: rand(0.6, 1.25) * (kind === 1 ? 1.35 : 1),
      kind,
      color: palette[(Math.random() * palette.length) | 0],
      size: kind === 1 ? rand(4, 8) : kind === 0 ? rand(1.2, 2.2) : rand(1.5, 3),
      rot: rand(0, Math.PI * 2), vr: rand(-12, 12), flip: rand(0, Math.PI * 2),
    });
  }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
}

function ensureCanvas(): void {
  if (canvas && canvas.isConnected) return;
  canvas = document.createElement('canvas');
  canvas.className = 'fx-particles';
  ctx = canvas.getContext('2d');
  fxLayer().appendChild(canvas);
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas, { passive: true });
}

function sizeCanvas(): void {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}

function teardown(): void {
  cancelAnimationFrame(raf);
  raf = 0;
  particles = [];
  window.removeEventListener('resize', sizeCanvas);
  canvas?.remove();
  canvas = null;
  ctx = null;
}

function tick(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!ctx || !canvas || document.hidden) { teardown(); return; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  const alive: Particle[] = [];
  for (const p of particles) {
    p.life += dt;
    if (p.life >= p.max) continue;
    const drag = p.kind === 1 ? 2.6 : 1.6;
    p.vx -= p.vx * drag * dt;
    p.vy -= p.vy * drag * dt;
    p.vy += (p.kind === 1 ? 520 : 380) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.flip += 9 * dt;
    const k = p.life / p.max;
    const alpha = k < 0.1 ? k / 0.1 : 1 - Math.pow((k - 0.1) / 0.9, 1.6);
    if (p.kind === 0) {
      ctx.strokeStyle = rgba(p.color, alpha);
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      ctx.stroke();
    } else if (p.kind === 1) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = rgba(p.color, alpha);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
    } else {
      ctx.fillStyle = rgba(p.color, alpha * 0.35);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(mixRGB(p.color, [255, 255, 255], 0.6), alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    alive.push(p);
  }
  particles = alive;
  if (!particles.length) { teardown(); return; }
  raf = requestAnimationFrame(tick);
}
