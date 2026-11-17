import React, { useRef, useEffect } from 'react';
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

  useEffect(() => {
    const unsub = subscribeAudioLevel((level) => {
      currentLevelRef.current = level;
    });
    return unsub;
  }, [subscribeAudioLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let smoothedLevel = 0;

    const render = () => {
      const targetLevel = isAudioMuted ? 0 : currentLevelRef.current;
      smoothedLevel += (targetLevel - smoothedLevel) * 0.25;

      ctx.clearRect(0, 0, width, height);

      const barWidth = Math.max(2, Math.floor((width - (barCount - 1) * 2) / barCount));
      const gap = 2;
      const normalized = Math.min(100, Math.max(0, smoothedLevel)) / 100;
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

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [width, height, barCount, activeColor, inactiveColor, isAudioMuted]);

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
