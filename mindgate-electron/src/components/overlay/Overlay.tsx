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
  ollamaConnected?: boolean;
}

type OverlayState = 'chat' | 'loading' | 'approved' | 'denied' | 'takeover';

const DEFAULT_FIRST_MESSAGE = 'What do you need access for?';
const APPROVAL_DISPLAY_MS = 2500;

export const LiquidGlassOverlay = forwardRef<OverlayHandle, OverlayProps>(({ configuration, onClose, ollamaConnected = true }, ref) => {
  const [state, setState] = useState<OverlayState>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(configuration?.settings?.justificationCountdownDuration ?? 20);
  const [remainingAccessTime, setRemainingAccessTime] = useState<number | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isInputDisabled, setIsInputDisabled] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiThinking]);

  const focusInput = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    });
  };

  useEffect(() => {
    const handleFocusInput = () => {
      if (state === 'chat') {
        focusInput();
      }
    };
    window.addEventListener('mindgate-focus-input', handleFocusInput);
    return () => window.removeEventListener('mindgate-focus-input', handleFocusInput);
  }, [state]);

  const resetChatState = () => {
    setState('chat');
    setMessages([{ role: 'ai', content: DEFAULT_FIRST_MESSAGE, timestamp: Date.now() }]);
    setUserInput('');
    setAiResponse('');
    setRemainingAccessTime(null);
    setIsInputDisabled(false);
    setIsAiThinking(false);
    setCountdownSeconds(configuration?.settings?.justificationCountdownDuration ?? 20);
    focusInput();
  };

  useImperativeHandle(ref, () => ({
    resetChat: async () => {
      resetChatState();
    },
  }), [configuration]);

  useEffect(() => {
    resetChatState();
  }, []);

  useEffect(() => {
    if (state === 'chat' && !isAiThinking) {
      const timer = setInterval(() => {
        setCountdownSeconds((s) => Math.max(0, s - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, isAiThinking]);

  useEffect(() => {
    if (state === 'chat' && countdownSeconds <= 0) {
      void handleTimeout();
    }
  }, [countdownSeconds, state]);

  useEffect(() => {
    if (state === 'approved' && remainingAccessTime !== null) {
      const timer = setInterval(() => {
        setRemainingAccessTime((t) => (t !== null ? Math.max(0, t - 1) : null));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, remainingAccessTime]);

  useEffect(() => {
    if (state === 'chat') {
      focusInput();
    }
  }, [state]);

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
    if (!userInput.trim() || isInputDisabled) return;
    if (!window.mindgateAPI) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: 'MindGate bridge is unavailable. Please restart the app.', timestamp: Date.now() },
      ]);
      return;
    }

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
        try {
          await window.mindgateAPI.grantAccess(durationSeconds);
        } catch (err) {
          console.error('[Overlay] grantAccess failed:', err);
        }
        setRemainingAccessTime(durationSeconds);
        setTimeout(() => onClose(), APPROVAL_DISPLAY_MS);
      } else if (result.isApproved === false) {
        setAiResponse('Access denied. Stay focused on your work.');
        setState('denied');
        try {
          await window.mindgateAPI.closeDistraction();
        } catch (err) {
          console.error('[Overlay] closeDistraction failed on denial:', err);
        }
        setTimeout(() => setState('takeover'), 1500);
      } else {
        setState('chat');
        setIsInputDisabled(false);
        focusInput();
      }
    } catch (e) {
      setIsAiThinking(false);
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: `MindGate AI is unavailable: ${errorMsg}. Please try again.`, timestamp: Date.now() },
      ]);
      setState('chat');
      setIsInputDisabled(false);
      focusInput();
    }
  };

  const handleCountdownStyle = () => {
    const total = configuration?.settings?.justificationCountdownDuration ?? 20;
    const ratio = total > 0 ? countdownSeconds / total : 1;
    if (ratio > 0.5) return { color: 'rgba(255, 159, 10, 0.8)' };
    if (ratio > 0.25) return { color: 'rgba(255, 69, 58, 0.8)' };
    return { color: 'rgba(255, 59, 48, 1)' };
  };

  const renderChat = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="glass-message-container">
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px' }}>
            <div className="glass-dot glass-dot-active" style={{ width: '12px', height: '12px' }} />
            <div style={{ color: 'var(--glass-text)', fontSize: '15px', fontWeight: '600', textAlign: 'center' }}>MindGate is ready</div>
            <div style={{ color: 'var(--glass-text-secondary)', fontSize: '13px', textAlign: 'center' }}>Type your reason for access</div>
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
          disabled={isInputDisabled}
          rows={1}
          autoFocus
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={!userInput.trim() || isInputDisabled}
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

  const statusTitle = ollamaConnected ? 'AI available' : 'AI offline';

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
          <div className={ollamaConnected ? 'glass-status-connected' : 'glass-status-disconnected'} title={statusTitle} />
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
