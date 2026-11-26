import React, { useEffect, useRef } from 'react';

interface PetalCanvasProps {
  variant: 'intro' | 'main';
  className?: string;
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
  edgeColor: string;
  glowColor: string;
  alpha: number;
}

export const PetalCanvas: React.FC<PetalCanvasProps> = ({ variant, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    // Cánh hoa đào tự nhiên, dịu nhẹ (không phát sáng)
    const introPalettes = [
      { color: '#FFB7C5', edgeColor: '#E05776' },
      { color: '#FFA0B4', edgeColor: '#D64565' },
      { color: '#FFC8D3', edgeColor: '#E56B86' },
      { color: '#F48FA3', edgeColor: '#C93B5B' },
      { color: '#FFD6DF', edgeColor: '#DF6E88' },
    ];

    const mainPalettes = [
      { color: '#E2A6BA', edgeColor: '#B65A7C' },
      { color: '#B65A7C', edgeColor: '#9E4769' },
      { color: '#FFF0F5', edgeColor: '#E2A6BA' },
      { color: '#D689A4', edgeColor: '#9E4769' },
    ];

    const paletteList = variant === 'intro' ? introPalettes : mainPalettes;
    const count = prefersReduced ? 16 : width < 640 ? 28 : 42;

    const createPetal = (randomY = false): Petal => {
      const z = 0.4 + Math.random() * 0.8;
      const theme = paletteList[Math.floor(Math.random() * paletteList.length)];
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -25 - Math.random() * 80,
        z,
        size: (9 + Math.random() * 11) * z,
        speedY: (0.4 + Math.random() * 0.7) * z,
        speedX: (Math.random() - 0.3) * 0.5 * z,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.012 + Math.random() * 0.018,
        rotZ: Math.random() * Math.PI * 2,
        rotZSpeed: (Math.random() - 0.5) * 0.016,
        rotX: Math.random() * Math.PI * 2,
        rotXSpeed: 0.014 + Math.random() * 0.02,
        color: theme.color,
        edgeColor: theme.edgeColor,
        glowColor: 'transparent',
        alpha: variant === 'intro' ? 0.55 + z * 0.32 : 0.45 + z * 0.3,
      };
    };

    const petals: Petal[] = Array.from({ length: count }, () => createPetal(true));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let rafId = 0;

    const drawPetal = (p: Petal) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotZ);
      // Simulate 3D flutter using cosine scaling on Y axis
      const tiltScale = 0.35 + 0.65 * Math.abs(Math.cos(p.rotX));
      ctx.scale(1, tiltScale);

      ctx.globalAlpha = p.alpha;
      const s = p.size;

      // Bóng đổ nhẹ tự nhiên, không phát sáng
      ctx.shadowColor = 'rgba(58, 7, 31, 0.22)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const grad = ctx.createRadialGradient(-s * 0.2, -s * 0.25, s * 0.08, 0, 0, s);
      grad.addColorStop(0, '#FFE4EC');
      grad.addColorStop(0.55, p.color);
      grad.addColorStop(1, p.edgeColor);

      ctx.fillStyle = grad;

      // Cánh hoa đào với vết khía cong mềm mại đặc trưng ở đầu cánh
      ctx.beginPath();
      ctx.moveTo(0, s * 0.85);
      ctx.bezierCurveTo(-s * 0.75, s * 0.35, -s * 0.82, -s * 0.45, -s * 0.26, -s);
      ctx.quadraticCurveTo(0, -s * 0.78, s * 0.26, -s);
      ctx.bezierCurveTo(s * 0.82, -s * 0.45, s * 0.75, s * 0.35, 0, s * 0.85);
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

          if (p.y > height + 35 || p.x < -60 || p.x > width + 60) {
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
      className={
        className ||
        `pointer-events-none fixed inset-0 ${variant === 'intro' ? 'z-10' : 'z-10'} h-full w-full`
      }
    />
  );
};
