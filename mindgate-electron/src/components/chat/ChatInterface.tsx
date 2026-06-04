import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Configuration, DecisionResult } from '../../types';

interface ChatInterfaceProps {
  configuration: Configuration;
  onSubmit: (userInput: string) => Promise<DecisionResult | void>;
  onClose: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ configuration, onSubmit, onClose }) => {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [showDurationSelection, setShowDurationSelection] = useState(false);
  const [showDeniedMessage, setShowDeniedMessage] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (countdownSeconds > 0) {
        setCountdownSeconds(s => s - 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownSeconds]);

  const handleSubmit = async () => {
    if (!userInput.trim() || isLoading) return;
    
    setIsLoading(true);
    const result = await onSubmit(userInput);
    if (!result?.isApproved) {
      setShowDeniedMessage(true);
    }
    setIsLoading(false);
  };

  const startCountdown = () => {
    setCountdownSeconds(configuration.settings.justificationCountdownDuration);
  };

  React.useEffect(() => {
    startCountdown();
  }, []);

  const headlineText = () => {
    if (showDurationSelection) return 'Access granted';
    if (showDeniedMessage) return 'Access denied';
    if (isLoading) return 'Checking with AI';
    if (countdownSeconds > 0) return `Why are you here? (${countdownSeconds}s)`;
    return 'Why are you here?';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: configuration.theme.animation.orbTransitionDuration }}
      style={{
        width: configuration.theme.dimensions.orbExpandedWidth,
        height: configuration.theme.dimensions.orbExpandedHeight,
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0.18), rgba(255,255,255,0.12), rgba(0,0,0,0.25))',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative'
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 32,
          right: 36,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.2))',
          border: 'none',
          cursor: 'pointer',
          color: 'white',
          fontSize: 12
        }}
      >
        ×
      </button>

      <div style={{ marginTop: 12 }} />

      <h2 style={{
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        margin: 0
      }}>
        {headlineText()}
      </h2>

      {!showDurationSelection && !showDeniedMessage && !isLoading && !aiResponse && (
        <p style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.55)',
          textAlign: 'center',
          margin: 0
        }}>
          Distraction detected. Explain why.
        </p>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div style={{
                width: 20,
                height: 20,
                border: `2px solid ${configuration.theme.colors.warning}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>AI is thinking...</p>
            </motion.div>
          ) : aiResponse ? (
            <motion.div
              key="response"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ textAlign: 'center' }}
            >
              <TypingText text={aiResponse} configuration={configuration} />
              <button
                onClick={() => {
                  if (showDeniedMessage) {
                    setAiResponse('');
                    setShowDeniedMessage(false);
                    startCountdown();
                  } else {
                    onClose();
                    setAiResponse('');
                    setShowDeniedMessage(false);
                    setUserInput('');
                  }
                }}
                style={{
                  marginTop: 16,
                  padding: '8px 16px',
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.25))',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                {showDeniedMessage ? 'Try Again' : 'Close'}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <p style={{
                fontSize: 13,
                fontWeight: 'semibold',
                color: 'rgba(255,255,255,0.9)',
                textAlign: 'center',
                margin: '0 4px'
              }}>
                Why do you need access?
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 10,
                padding: 6,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15), rgba(0,0,0,0.2))',
                maxWidth: '100%'
              }}>
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="I need this because..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 13,
                    resize: 'none',
                    outline: 'none',
                    minHeight: 50
                  }}
                  onKeyDown={(e) => e.metaKey && e.key === 'Enter' && handleSubmit()}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!userInput.trim() || isLoading}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: userInput.trim() 
                      ? 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7))'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15))',
                    border: 'none',
                    color: 'white',
                    cursor: userInput.trim() ? 'pointer' : 'default',
                    fontSize: 14
                  }}
                >
                  ↑
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
};

interface TypingTextProps {
  text: string;
  configuration: Configuration;
}

const TypingText: React.FC<TypingTextProps> = ({ text, configuration }) => {
  const [displayedText, setDisplayedText] = React.useState('');

  React.useEffect(() => {
    let index = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(prev => prev + text[index]);
        index++;
      } else {
        clearInterval(timer);
      }
    }, 20);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <p style={{
      fontSize: 14,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      lineHeight: 1.4
    }}>
      {displayedText}
    </p>
  );
};