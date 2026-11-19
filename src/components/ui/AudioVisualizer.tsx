import React, { useRef, useEffect, useCallback } from 'react';
import { useMedia } from '../../app/providers/MediaContext';

interface AudioVisualizerProps {
  width?: number;
  height?: number;
  barCount?: number;
  activeColor?: string;
  inactiveColor?: string;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  width = 64,
  height = 14,
  barCount = 8,
  activeColor = '#5e6ad2',
  inactiveColor = '#23252a',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { subscribeAudioLevel, isAudioMuted } = useMedia();
  const currentLevelRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef<boolean>(false);
  const smoothedLevelRef = useRef<number>(0);

  const drawBars = useCallback(
    (ctx: CanvasRenderingContext2D, level: number) => {
      ctx.clearRect(0, 0, width, height);

      const barWidth = Math.max(2, Math.floor((width - (barCount - 1) * 2) / barCount));
      const gap = 2;
      const normalized = Math.min(100, Math.max(0, level)) / 100;
      const activeBars = Math.round(normalized * barCount);

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + gap);
        const isActive = i <= activeBars && normalized > 0.05;

        // Heights scale slightly upwards towards middle/right for a waveform effect
        const barHeightFraction = 0.4 + (i / barCount) * 0.6;
        const barH = Math.max(3, height * barHeightFraction);
        const y = height - barH;

        ctx.fillStyle = isActive ? activeColor : inactiveColor;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barWidth, barH, 1.5) : ctx.rect(x, y, barWidth, barH);
        ctx.fill();
      }
    },
    [width, height, barCount, activeColor, inactiveColor]
  );

  const startLoop = useCallback(() => {
    if (isLoopRunningRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isLoopRunningRef.current = true;

    const render = () => {
      const targetLevel = isAudioMuted ? 0 : currentLevelRef.current;
      smoothedLevelRef.current += (targetLevel - smoothedLevelRef.current) * 0.25;

      drawBars(ctx, smoothedLevelRef.current);

      // Sleep loop when audio is completely quiet or muted to save CPU / battery
      if (targetLevel === 0 && smoothedLevelRef.current < 0.2) {
        smoothedLevelRef.current = 0;
        drawBars(ctx, 0);
        isLoopRunningRef.current = false;
        animFrameRef.current = null;
        return;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
  }, [drawBars, isAudioMuted]);

  useEffect(() => {
    startLoop();
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
        isLoopRunningRef.current = false;
      }
    };
  }, [startLoop]);

  useEffect(() => {
    const unsub = subscribeAudioLevel((level) => {
      currentLevelRef.current = level;
      if (level > 0 && !isLoopRunningRef.current) {
        startLoop();
      }
    });
    return unsub;
  }, [subscribeAudioLevel, startLoop]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`audio-visualizer-canvas ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
};
