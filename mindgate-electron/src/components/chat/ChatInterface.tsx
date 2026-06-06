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
  const [remainingAccessTime, setRemainingAccessTime] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      if (countdownSeconds > 0) {
        setCountdownSeconds(s => s - 1);
      } else if (countdownSeconds === 0 && !isLoading && !showDurationSelection && !showDeniedMessage && !aiResponse && userInput === '') {
        handleCountdownExpired();
      }
      
      if (showDurationSelection) {
        window.mindgateAPI.getRemainingAccessTime().then(time => {
          if (time > 0) {
            setRemainingAccessTime(time);
          }
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownSeconds, isLoading, showDurationSelection, showDeniedMessage, aiResponse, userInput]);

  useEffect(() => {
    startCountdown();
  }, []);

  const handleSubmit = async () => {
    if (!userInput.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const result = await onSubmit(userInput);
      if (!result) {
        setAiResponse('No response received');
        setShowDeniedMessage(true);
      } else if (result.isApproved) {
        setAiResponse(result.message);
        setShowDurationSelection(true);
      } else {
        setAiResponse(result.message);
        setShowDeniedMessage(true);
      }
    } catch (error) {
      setAiResponse('Error: Unable to get AI response');
      setShowDeniedMessage(true);
    }
    setIsLoading(false);
  };

  const startCountdown = () => {
    setCountdownSeconds(configuration.settings.justificationCountdownDuration);
  };

  const handleCountdownExpired = () => {
    setAiResponse("Time's up! Access denied.");
    setShowDeniedMessage(true);
    window.mindgateAPI.closeDistraction();
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const headlineText = () => {
    if (showDurationSelection) return 'Access granted';
    if (showDeniedMessage) return 'Access denied';
    if (isLoading) return 'Checking with AI';
    if (countdownSeconds > 0) return `Why are you here? (${countdownSeconds}s)`;
    return 'Why are you here?';
  };

  const selectDuration = (index: number) => {
    const duration = configuration.settings.accessDurations[index];
    window.mindgateAPI.grantAccess(index);
    onClose();
    resetState();
  };

  const resetState = () => {
    setUserInput('');
    setAiResponse('');
    setIsLoading(false);
    setShowDurationSelection(false);
    setShowDeniedMessage(false);
    setCountdownSeconds(0);
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
        position: 'relative',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
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
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: `2px solid ${configuration.theme.colors.warning}`,
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
              <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>AI is thinking...</p>
            </motion.div>
          ) : showDurationSelection ? (
            <motion.div
              key="duration"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <p style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.68)',
                textAlign: 'center',
                margin: 0
              }}>
                Choose duration:
              </p>
              {remainingAccessTime !== null && (
                <p style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                  textAlign: 'center',
                  margin: 0
                }}>
                  Access expires in: {remainingAccessTime}s
                </p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {configuration.settings.accessDurationLabels.map((label, index) => (
                  <button
                    key={index}
                    onClick={() => selectDuration(index)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.25))',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
                    resetState();
                    startCountdown();
                  } else {
                    onClose();
                    resetState();
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
                    minHeight: 50,
                    padding: '8px 12px'
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
    const words = text.split(' ');
    setDisplayedText('');
    let wordIndex = 0;
    
    const timer = setInterval(() => {
      if (wordIndex < words.length) {
        setDisplayedText(prev => {
          const newText = prev + (prev ? ' ' : '') + words[wordIndex];
          return newText;
        });
        wordIndex++;
      } else {
        clearInterval(timer);
      }
    }, 100);
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