"use client";

import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  isActive: boolean;
}

export function AudioVisualizer({ isActive }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Create gradient
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        80,
      );
      gradient.addColorStop(
        0,
        isActive ? "rgba(16, 185, 129, 0.5)" : "rgba(16, 185, 129, 0.28)",
      );
      gradient.addColorStop(
        0.5,
        isActive ? "rgba(14, 165, 233, 0.24)" : "rgba(16, 185, 129, 0.14)",
      );
      gradient.addColorStop(1, "rgba(14, 165, 233, 0)");

      // Draw pulsing circles
      for (let i = 0; i < 3; i++) {
        const offset = (i * (Math.PI * 2)) / 3;
        const pulse = Math.sin(phase + offset) * 10;
        const radius = 60 + pulse;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw center sphere
      const sphereGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        40,
      );
      sphereGradient.addColorStop(0, "rgba(16, 185, 129, 0.9)");
      sphereGradient.addColorStop(1, "rgba(14, 165, 233, 0.82)");

      ctx.beginPath();
      ctx.arc(centerX, centerY, 40 + Math.sin(phase) * 5, 0, Math.PI * 2);
      ctx.fillStyle = sphereGradient;
      ctx.fill();

      phase += isActive ? 0.08 : 0.03;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive]);

  return (
    <canvas ref={canvasRef} width={190} height={190} className="rounded-full" />
  );
}
