import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Configuration, ChatMessage } from '../../types';
import { TakeoverView } from '../takeover/TakeoverView';
import { MessageList } from './MessageBubble';
import '../../styles/glassmorphism.css';

export interface OverlayHandle {
  resetChat: () => Promise<void>;
}

interface OverlayProps {
  configuration: Configuration | null;
  onClose: () => void;
}

type OverlayState = 'chat' | 'loading' | 'approved' | 'denied' | 'takeover';

const AI_INIT_TIMEOUT_MS = 3000;
const APPROVAL_DISPLAY_MS = 2500;

export const LiquidGlassOverlay = forwardRef<OverlayHandle, OverlayProps>(({ configuration, onClose }, ref) => {
  const [state, setState] = useState<OverlayState>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(configuration?.settings?.justificationCountdownDuration ?? 20);
  const [remainingAccessTime, setRemainingAccessTime] = useState<number | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isInputDisabled, setIsInputDisabled] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiThinking]);

  useEffect(() => {
    const handleFocusInput = () => {
      if (inputRef.current && !isInputDisabled) {
        inputRef.current.focus();
      }
    };
    window.addEventListener('mindgate-focus-input', handleFocusInput);
    return () => window.removeEventListener('mindgate-focus-input', handleFocusInput);
  }, [isInputDisabled]);

  const waitForMindgateAPI = async (maxWaitMs = 3000): Promise<boolean> => {
    if (window.__MINDGATE_BRIDGE_READY__) {
      return true;
    }

    const preloadReady = (window as unknown as { __preloadReady?: Promise<void> }).__preloadReady;
    if (preloadReady) {
      console.log('[Overlay] Waiting for preload-ready-ack...');
      await Promise.race([
        preloadReady,
        new Promise((_, reject) => setTimeout(() => reject(new Error('preload timeout')), maxWaitMs - 100)),
      ]).catch(() => {});
    }

    return new Promise((resolve) => {
      if (window.mindgateAPI) {
        resolve(true);
        return;
      }

      const pollInterval = setInterval(() => {
        if (window.mindgateAPI) {
          clearInterval(pollInterval);
          resolve(true);
        }
      }, 50);

      setTimeout(() => {
        clearInterval(pollInterval);
        console.error('[Overlay] mindgateAPI not available after waiting. window object:', Object.keys(window).filter((k) => k.includes('mindgate')));
        resolve(!!window.mindgateAPI);
      }, maxWaitMs);
    });
  };

  const initChat = async () => {
    const apiReady = await waitForMindgateAPI();
    if (!apiReady) {
      setMessages([{ role: 'ai', content: 'MindGate bridge not initialized. Please restart the app.', timestamp: Date.now() }]);
      setChatError('Connection failed. Click Retry to try again.');
      setAiReady(true);
      return;
    }

    try {
      await window.mindgateAPI.resetChat();
    } catch (e) {
      console.warn('[Overlay] resetChat failed:', e);
    }

    let firstMessage = '';
    try {
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('AI response timed out')), AI_INIT_TIMEOUT_MS);
      });
      firstMessage = await Promise.race([
        window.mindgateAPI.generateFirstMessage(),
        timeoutPromise,
      ]);
    } catch {
      firstMessage = "I see you're trying to access a distracting website. Why do you need to be here?";
    }

    setMessages([{ role: 'ai', content: firstMessage, timestamp: Date.now() }]);
    setChatError(null);
    setAiReady(true);
    setTimeout(() => {
      if (inputRef.current && !isInputDisabled) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setChatError(null);
    setMessages([]);
    try {
      await initChat();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setChatError(`Failed to start AI chat: ${errorMsg}. Click Retry to try again.`);
    } finally {
      setIsRetrying(false);
    }
  };

  useImperativeHandle(ref, () => ({
    resetChat: async () => {
      setState('chat');
      setMessages([]);
      setUserInput('');
      setAiResponse('');
      setRemainingAccessTime(null);
      setIsInputDisabled(false);
      setAiReady(false);
      setChatError(null);
      setIsRetrying(false);
      setIsAiThinking(false);
      setCountdownSeconds(configuration?.settings?.justificationCountdownDuration ?? 20);
      await initChat();
    },
  }), [configuration]);

  useEffect(() => {
    void initChat();
  }, []);

  useEffect(() => {
    if (state === 'chat' && aiReady && !isAiThinking) {
      const timer = setInterval(() => {
        setCountdownSeconds((s) => s - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, aiReady, isAiThinking]);

  useEffect(() => {
    if (state === 'chat' && aiReady && countdownSeconds <= 0) {
      void handleTimeout();
    }
  }, [countdownSeconds, state, aiReady]);

  useEffect(() => {
    if (state === 'approved' && remainingAccessTime !== null) {
      const timer = setInterval(() => {
        setRemainingAccessTime((t) => (t !== null ? Math.max(0, t - 1) : null));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, remainingAccessTime]);

  const handleTimeout = async () => {
    setIsInputDisabled(true);
    setMessages((prev) => [...prev, { role: 'ai', content: "Time's up! Access denied.", timestamp: Date.now() }]);
    if (window.mindgateAPI) {
      try {
        await window.mindgateAPI.closeDistraction();
      } catch (err) {
        console.error('[Overlay] closeDistraction failed on timeout:', err);
      }
    }
    setTimeout(() => {
      setState('takeover');
    }, 1000);
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || isInputDisabled || !window.mindgateAPI) return;

    const input = userInput.trim();
    setUserInput('');
    setMessages((prev) => [...prev, { role: 'user', content: input, timestamp: Date.now() }]);
    setIsInputDisabled(true);
    setIsAiThinking(true);
    setState('loading');

    try {
      const result = await window.mindgateAPI.sendChatMessage(input);
      setIsAiThinking(false);

      if (result.message) {
        setMessages((prev) => [...prev, { role: 'ai', content: result.message, timestamp: Date.now() }]);
      }

      if (result.isApproved === true) {
        const mins = result.durationMinutes || 10;
        const durationSeconds = mins * 60;
        setAiResponse(`Access approved for ${mins} minutes. Stay focused.`);
        setState('approved');
        if (window.mindgateAPI) {
          try {
            await window.mindgateAPI.grantAccess(durationSeconds);
          } catch (err) {
            console.error('[Overlay] grantAccess failed:', err);
          }
        }
        setRemainingAccessTime(durationSeconds);
        setTimeout(() => onClose(), APPROVAL_DISPLAY_MS);
      } else if (result.isApproved === false) {
        setAiResponse('Access denied. Stay focused on your work.');
        setState('denied');
        if (window.mindgateAPI) {
          try {
            await window.mindgateAPI.closeDistraction();
          } catch (err) {
            console.error('[Overlay] closeDistraction failed on denial:', err);
          }
        }
        setTimeout(() => setState('takeover'), 1500);
      } else {
        setState('chat');
        setIsInputDisabled(false);
        setTimeout(() => {
          if (inputRef.current && !isInputDisabled) {
            inputRef.current.focus();
          }
        }, 50);
      }
    } catch (e) {
      setIsAiThinking(false);
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setMessages((prev) => [...prev, { role: 'ai', content: `Error: ${errorMsg}. Please try again.`, timestamp: Date.now() }]);
      setState('chat');
      setIsInputDisabled(false);
    }
  };

  const handleCountdownStyle = () => {
    const total = configuration?.settings?.justificationCountdownDuration ?? 20;
    const ratio = countdownSeconds / total;
    if (ratio > 0.5) return { color: 'rgba(255, 159, 10, 0.8)' };
    if (ratio > 0.25) return { color: 'rgba(255, 69, 58, 0.8)' };
    return { color: 'rgba(255, 59, 48, 1)' };
  };

  const renderChat = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="glass-message-container">
        {chatError && messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px' }}>
            <div style={{ color: '#ff3b30', fontSize: '16px', fontWeight: '600', textAlign: 'center' }}>Connection Error</div>
            <div style={{ color: '#8e8e93', fontSize: '13px', textAlign: 'center', lineHeight: 1.5, maxWidth: '220px' }}>{chatError}</div>
            <button onClick={() => void handleRetry()} disabled={isRetrying} className="glass-btn">
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px' }}>
            <div className="glass-dot glass-dot-active" style={{ width: '12px', height: '12px' }} />
            <div style={{ color: 'var(--glass-text)', fontSize: '15px', fontWeight: '600', textAlign: 'center' }}>Initializing AI...</div>
            <div style={{ color: 'var(--glass-text-secondary)', fontSize: '13px', textAlign: 'center' }}>Connecting to MindGate AI</div>
          </div>
        ) : (
          <MessageList messages={messages} isAiThinking={isAiThinking} />
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="glass-divider" />

      <div className="glass-input-container">
        <textarea
          ref={inputRef}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="Type your response..."
          className="glass-input"
          disabled={isInputDisabled || !!chatError}
          rows={1}
          autoFocus
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={!userInput.trim() || isInputDisabled || !!chatError}
          className="glass-btn"
          style={{ height: '40px', padding: '0 16px', flexShrink: 0 }}
        >
          Send
        </button>
      </div>
    </div>
  );

  const renderApproved = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <div style={{ fontSize: '48px' }}>✓</div>
      <p style={{ fontSize: '16px', fontWeight: '600', color: '#30d158', textAlign: 'center', margin: 0 }}>{aiResponse}</p>
      {remainingAccessTime !== null && (
        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', textAlign: 'center', margin: 0 }}>
          Time remaining: {Math.floor(remainingAccessTime / 60)}m {remainingAccessTime % 60}s
        </p>
      )}
    </div>
  );

  const renderDenied = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <div style={{ fontSize: '48px' }}>✗</div>
      <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--glass-error)', textAlign: 'center', margin: 0 }}>{aiResponse}</p>
    </div>
  );

  const renderTakeover = () => (
    <TakeoverView configuration={configuration} onDismiss={onClose} />
  );

  const renderContent = () => {
    switch (state) {
      case 'loading': return renderChat();
      case 'approved': return renderApproved();
      case 'denied': return renderDenied();
      case 'takeover': return renderTakeover();
      default: return renderChat();
    }
  };

  return (
    <div
      className="glass-panel"
      style={{
        position: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        top: 0,
        left: 0,
        width: `${configuration?.theme?.dimensions?.overlayWidth ?? 280}px`,
        height: `${configuration?.theme?.dimensions?.overlayHeight ?? 280}px`,
        padding: '18px',
        pointerEvents: 'auto',
        zIndex: 2147483647,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div className="glass-header">
          <div className="glass-avatar">MG</div>
          <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--glass-text)' }}>MindGate AI</span>
          <div className={aiReady ? 'glass-status-connected' : 'glass-status-disconnected'} title={aiReady ? 'Connected' : 'Disconnected'} />
        </div>
        {state === 'chat' && (
          <span className="glass-countdown" style={handleCountdownStyle()}>
            {countdownSeconds}s
          </span>
        )}
      </div>
      <div className="glass-divider" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{renderContent()}</div>
    </div>
  );
});

LiquidGlassOverlay.displayName = 'LiquidGlassOverlay';