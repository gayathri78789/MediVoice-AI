import React from 'react';
import { motion } from 'framer-motion';
import type { CallState } from '../types';

interface WaveformVisualizerProps {
  callState: CallState;
  audioLevel: number; // 0..1
  botSpeaking: boolean;
  muted: boolean;
}

const BAR_WEIGHTS = [0.3, 0.5, 0.75, 0.95, 0.65, 1.0, 0.8, 0.9, 0.6, 0.85, 0.7, 0.45, 0.35];

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  callState,
  audioLevel,
  botSpeaking,
  muted,
}) => {
  const isActive = callState === 'connected';
  const effectiveLevel = !isActive ? 0.08 : muted && !botSpeaking ? 0.1 : Math.max(0.14, audioLevel);

  return (
    <div className="flex h-16 items-center justify-center gap-1.5" aria-label="Voice audio waveform">
      {BAR_WEIGHTS.map((weight, idx) => {
        const heightPct =
          callState === 'connecting'
            ? 25 + ((idx % 3) * 15)
            : Math.min(100, Math.round(effectiveLevel * weight * 100));

        return (
          <motion.div
            key={idx}
            animate={{
              height: `${heightPct}%`,
              opacity: isActive ? 1 : 0.45,
            }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
            }}
            className={`w-1.5 rounded-full transition-colors ${
              botSpeaking
                ? 'bg-emerald-500'
                : callState === 'connected'
                ? 'bg-teal-600'
                : callState === 'connecting'
                ? 'animate-pulse bg-amber-500'
                : 'bg-slate-300'
            }`}
          />
        );
      })}
    </div>
  );
};
