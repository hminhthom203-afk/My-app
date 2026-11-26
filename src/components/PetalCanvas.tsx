import React, { useEffect, useRef } from 'react';

interface PetalCanvasProps {
  variant: 'intro' | 'main';
}

interface Petal {
  x: number;
  y: number;
  z: number; // depth 0.35..1.15
  size: number;
  speedY: number;
  speedX: number;
  swayPhase: number;
  swaySpeed: number;
  rotZ: number;
  rotZSpeed: number;
  rotX: number;
  rotXSpeed: number;
  color: string;
  alpha: number;
}

export const PetalCanvas: React.FC<PetalCanvasProps> = ({ variant }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const palette =
      variant === 'intro'
        ? ['#FFF0F5', '#E2A6BA', '#F5CBD9', '#B65A7C']
        : ['#E2A6BA', '#B65A7C', '#FFF0F5', '#D689A4'];

    const count = prefersReduced ? 12 : width < 640 ? 22 : 34;

    const createPetal = (randomY = false): Petal => {
      const z = 0.4 + Math.random() * 0.8;
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -20 - Math.random() * 80,
        z,
        size: (8 + Math.random() * 10) * z,
        speedY: (0.45 + Math.random() * 0.75) * z,
        speedX: (Math.random() - 0.3) * 0.55 * z,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.012 + Math.random() * 0.018,
        rotZ: Math.random() * Math.PI * 2,
        rotZSpeed: (Math.random() - 0.5) * 0.018,
        rotX: Math.random() * Math.PI * 2,
        rotXSpeed: 0.015 + Math.random() * 0.02,
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: variant === 'intro' ? 0.35 + z * 0.35 : 0.45 + z * 0.3,
      };
    };

    const petals: Petal[] = Array.from({ length: count }, () => createPetal(true));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let rafId = 0;

    const drawPetal = (p: Petal) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotZ);
      // Simulate 3D flutter using cosine scaling on Y axis
      const tiltScale = 0.38 + 0.62 * Math.abs(Math.cos(p.rotX));
      ctx.scale(1, tiltScale);

      ctx.globalAlpha = p.alpha;
      const s = p.size;

      const grad = ctx.createRadialGradient(-s * 0.2, -s * 0.2, s * 0.1, 0, 0, s);
      grad.addColorStop(0, '#FFF0F5');
      grad.addColorStop(0.55, p.color);
      grad.addColorStop(1, variant === 'intro' ? '#B65A7C' : '#9E4769');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.85, -s * 0.6, s * 0.9, s * 0.55, 0, s * 0.9);
      ctx.bezierCurveTo(-s * 0.9, s * 0.55, -s * 0.85, -s * 0.6, 0, -s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        if (!prefersReduced) {
          p.swayPhase += p.swaySpeed;
          p.x += p.speedX + Math.sin(p.swayPhase) * 0.45 * p.z;
          p.y += p.speedY;
          p.rotZ += p.rotZSpeed;
          p.rotX += p.rotXSpeed;

          if (p.y > height + 30 || p.x < -50 || p.x > width + 50) {
            petals[i] = createPetal(false);
          }
        }
        drawPetal(p);
      }
      if (!prefersReduced) {
        rafId = window.requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10 h-full w-full"
    />
  );
};
