import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/cn';

interface ParticleFieldProps {
  /** particle count at ~1280x800; scales with area */
  density?: number;
  /** stable placement across reloads */
  seed?: number;
  /** occasional streaks across the field */
  shootingStars?: boolean;
  /** drift the field slightly with the pointer */
  parallax?: boolean;
  className?: string;
}

const COLORS = ['#2FE0D8', '#FF6FB0', '#FFC44D', '#FF8A6E', '#FFFFFF'];
/** white shows up more often so the field reads as starlight, not confetti */
const COLOR_WEIGHTS = [0.2, 0.18, 0.18, 0.12, 0.32];

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickColor(r: number) {
  let acc = 0;
  for (let i = 0; i < COLORS.length; i++) {
    acc += COLOR_WEIGHTS[i];
    if (r <= acc) return i;
  }
  return COLORS.length - 1;
}

/** Pre-rendered soft glow per colour — far cheaper than a gradient per frame. */
function makeSprites(dpr: number) {
  return COLORS.map((color) => {
    const size = Math.ceil(32 * dpr);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    if (!g) return c;
    const half = size / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, color);
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.globalAlpha = 1;
    g.beginPath();
    g.arc(half, half, half, 0, Math.PI * 2);
    g.fill();
    return c;
  });
}

interface Particle {
  x: number;
  y: number;
  r: number;
  depth: number;
  vx: number;
  vy: number;
  color: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface Streak {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  len: number;
}

/**
 * Live starfield: drifting, twinkling motes of brand light on a canvas, with
 * gentle pointer parallax and the occasional shooting star. One canvas element
 * instead of dozens of DOM nodes, paused whenever it scrolls out of view.
 */
export default function ParticleField({
  density = 90,
  seed = 1,
  shootingStars = false,
  parallax = true,
  className,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sprites = makeSprites(dpr);
    const rand = mulberry32(seed * 7919 + density);

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let streaks: Streak[] = [];
    let raf = 0;
    let last = performance.now();
    let visible = true;

    // pointer parallax, eased toward the target each frame
    let targetX = 0;
    let targetY = 0;
    let offsetX = 0;
    let offsetY = 0;

    const makeParticle = (local: () => number, w: number, h: number): Particle => {
      const depth = 0.35 + local() * 0.65;
      return {
        x: local() * w,
        y: local() * h,
        r: (0.7 + local() * 1.9) * depth,
        depth,
        vx: (local() - 0.5) * 5 * depth,
        vy: (local() - 0.5) * 5 * depth - 1.5 * depth,
        color: pickColor(local()),
        alpha: 0.3 + local() * 0.55,
        twinkleSpeed: 0.25 + local() * 0.8,
        twinklePhase: local() * Math.PI * 2,
      };
    };

    /**
     * Resizes must NOT regenerate the field — a scroll-lock (opening a modal),
     * a scrollbar appearing, or a mobile URL bar collapsing all fire the
     * ResizeObserver, and rebuilding makes every particle teleport at once.
     * Existing particles are remapped proportionally instead.
     */
    const build = (initial = false) => {
      const rect = parent.getBoundingClientRect();
      const nextW = Math.max(1, rect.width);
      const nextH = Math.max(1, rect.height);
      if (!initial && Math.abs(nextW - width) < 1 && Math.abs(nextH - height) < 1) return;

      const scaleX = width ? nextW / width : 1;
      const scaleY = height ? nextH / height : 1;
      width = nextW;
      height = nextH;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(
        Math.min(density * 1.6, Math.max(18, (density * (width * height)) / (1280 * 800))),
      );
      const local = mulberry32(seed * 104729 + count);

      if (initial || particles.length === 0) {
        particles = Array.from({ length: count }, () => makeParticle(local, width, height));
        return;
      }

      for (const p of particles) {
        p.x *= scaleX;
        p.y *= scaleY;
      }
      if (count > particles.length) {
        for (let i = particles.length; i < count; i++) {
          particles.push(makeParticle(local, width, height));
        }
      } else if (count < particles.length) {
        particles.length = count;
      }
    };

    const spawnStreak = () => {
      const fromLeft = rand() > 0.5;
      const speed = 260 + rand() * 200;
      const angle = (12 + rand() * 16) * (Math.PI / 180);
      streaks.push({
        x: fromLeft ? -40 : width + 40,
        y: rand() * height * 0.55,
        vx: (fromLeft ? 1 : -1) * speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
        life: 0,
        maxLife: 0.9 + rand() * 0.5,
        len: 90 + rand() * 80,
      });
    };

    const drawParticles = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (const p of particles) {
        const twinkle = reduced
          ? 1
          : 0.62 + 0.38 * Math.sin(time * p.twinkleSpeed + p.twinklePhase);
        const size = p.r * 7;
        ctx.globalAlpha = Math.min(1, p.alpha * twinkle);
        ctx.drawImage(
          sprites[p.color],
          p.x + offsetX * p.depth - size / 2,
          p.y + offsetY * p.depth - size / 2,
          size,
          size,
        );
      }

      for (const s of streaks) {
        const t = s.life / s.maxLife;
        const fade = Math.sin(Math.PI * t);
        const nx = s.vx / Math.hypot(s.vx, s.vy);
        const ny = s.vy / Math.hypot(s.vx, s.vy);
        const grad = ctx.createLinearGradient(
          s.x,
          s.y,
          s.x - nx * s.len,
          s.y - ny * s.len,
        );
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.35, 'rgba(47,224,216,0.35)');
        grad.addColorStop(1, 'transparent');
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - nx * s.len, s.y - ny * s.len);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      offsetX += (targetX - offsetX) * 0.045;
      offsetY += (targetY - offsetY) * 0.045;

      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const pad = 24;
        if (p.x < -pad) p.x = width + pad;
        else if (p.x > width + pad) p.x = -pad;
        if (p.y < -pad) p.y = height + pad;
        else if (p.y > height + pad) p.y = -pad;
      }

      if (shootingStars && streaks.length < 2 && Math.random() < dt * 0.09) spawnStreak();
      for (const s of streaks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life += dt;
      }
      streaks = streaks.filter((s) => s.life < s.maxLife);

      drawParticles(now / 1000);
      raf = requestAnimationFrame(frame);
    };

    build(true);

    if (reduced) {
      // one static, well-composed frame — no loop at all
      drawParticles(0);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(() => {
      build();
      if (reduced) drawParticles(0);
    });
    ro.observe(parent);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (reduced) return;
        if (visible && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        } else if (!visible && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { rootMargin: '120px' },
    );
    io.observe(parent);

    const onPointerMove = (e: PointerEvent) => {
      if (!parallax || reduced) return;
      const rect = parent.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * -26;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * -18;
    };
    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };
    if (parallax && !reduced) {
      parent.addEventListener('pointermove', onPointerMove);
      parent.addEventListener('pointerleave', onPointerLeave);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      parent.removeEventListener('pointermove', onPointerMove);
      parent.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [density, seed, shootingStars, parallax, reduced]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('absolute inset-0 z-0 pointer-events-none', className)}
      aria-hidden="true"
    />
  );
}
