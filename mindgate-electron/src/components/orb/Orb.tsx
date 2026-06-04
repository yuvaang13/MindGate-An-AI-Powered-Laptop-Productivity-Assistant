import React from 'react';
import { motion } from 'framer-motion';
import { Configuration } from '../../types';

export const LiquidGlassButtonStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.2))',
  border: 'none',
  borderRadius: '50%',
  cursor: 'pointer',
  color: 'white',
  fontSize: 14,
  padding: 0,
};

interface FlowingLinesViewProps {
  size: number;
  configuration: Configuration;
  isHovered: boolean;
}

export const FlowingLinesView: React.FC<FlowingLinesViewProps> = ({ size, configuration, isHovered }) => {
  const breathingScale = isHovered ? 1 + 0.1 : 1 + 0.04;
  const breathingOpacity = isHovered ? 0.92 + 0.08 : 0.96 + 0.04;
  const glowEffect = isHovered ? 0.2 : 0.08;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${configuration.theme.colors.background}FA, ${configuration.theme.colors.background}E5)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}
    >
      <motion.div
        style={{
          scale: breathingScale,
          opacity: breathingOpacity
        }}
        animate={{
          scale: breathingScale,
          opacity: breathingOpacity
        }}
        transition={{
          duration: configuration.theme.animation.orbBreathingDuration,
          repeat: Infinity,
          ease: 'easeInOut',
          repeatType: 'reverse'
        }}
      >
        <svg width={size * 0.85} height={size * 0.65}>
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={glowEffect} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          
          {[...Array(3)].map((_, i) => (
            <path
              key={`bg-${i}`}
              d={generateFlowingPath(size * 0.85, size * 0.65, 12 + i * 4, 0.025 + i * 0.008, (i - 1) * 12)}
              stroke="#ffffff"
              strokeWidth={2}
              strokeOpacity={0.15 - i * 0.03}
              fill="none"
            />
          ))}
          
          {[...Array(5)].map((_, i) => (
            <path
              key={`mid-${i}`}
              d={generateFlowingPath(size * 0.85, size * 0.65, 18 + i * 3.5, 0.035 + i * 0.006, (i - 2) * 10)}
              stroke="#ffffff"
              strokeWidth={1.8}
              strokeOpacity={0.5 - i * 0.07}
              fill="none"
            />
          ))}
          
          {[...Array(2)].map((_, i) => (
            <path
              key={`fg-${i}`}
              d={generateFlowingPath(size * 0.85, size * 0.65, 22 + i * 2, 0.04 + i * 0.004, (i - 0.5) * 15)}
              stroke="#ffffff"
              strokeWidth={1.2}
              strokeOpacity={0.7 - i * 0.1}
              fill="none"
            />
          ))}
        </svg>
      </motion.div>
    </div>
  );
};

function generateFlowingPath(width: number, height: number, amplitude: number, frequency: number, yOffset: number): string {
  const midY = height / 2 + yOffset;
  const points: string[] = [];
  
  for (let x = 0; x <= width; x += 2) {
    const normalizedX = x / width;
    const y = midY + Math.sin(normalizedX * Math.PI * 2 * frequency) * amplitude * Math.sin(normalizedX * Math.PI);
    points.push(`${x},${y}`);
  }
  
  return `M0,${midY} ${points.map(p => `L${p}`).join(' ')}`;
}

interface OrbProps {
  configuration: Configuration;
  onExpand: () => void;
}

export const Orb: React.FC<OrbProps> = ({ configuration, onExpand }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.div
      onClick={onExpand}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <FlowingLinesView
        size={configuration.theme.dimensions.orbSize}
        configuration={configuration}
        isHovered={isHovered}
      />
    </motion.div>
  );
};