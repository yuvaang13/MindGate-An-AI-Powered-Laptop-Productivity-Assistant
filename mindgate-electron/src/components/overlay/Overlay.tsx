import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Configuration, ChatMessage } from '../../types.js';
import { TakeoverView } from '../takeover/TakeoverView.js';
import { MessageList } from './MessageBubble.js';
import { waitForBridgeStatus, waitForMindgateAPI } from '../../utils/bridge.js';
import '../../styles/glassmorphism.css';

export interface OverlayHandle {
  resetChat: () => Promise<void>;
}

interface OverlayProps {
  configuration: Configuration | null;
  onClose: () => void;
}

type OverlayState = 'preparing' | 'chat' | 'loading' | 'approved' | 'denied' | 'takeover';

const DEFAULT_FIRST_MESSAGE = 'What do you need access for?';
const APPROVAL_DISPLAY_MS = 2000;

const isConnectionMessage = (message: string) => {
  return /connection|ollama|starting|unavailable|not ready|try again|connecting/i.test(message);
};

export const LiquidGlassOverlay = forwardRef<OverlayHandle, OverlayProps>(({ 
  configuration, 
  onClose 
}, ref) => {
  const [state, setState] = useState<OverlayState>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { role: 'ai', content: DEFAULT_FIRST_MESSAGE, timestamp: Date.now() },
  ]);
  const [userInput, setUserInput] = useState('');
  const [remainingAccessTime, setRemainingAccessTime] = useState<number | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isInputDisabled, setIsInputDisabled] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isAiReady, setIsAiReady] = useState(true);
  const [aiReadinessConfirmed, setAiReadinessConfirmed] = useState(false);
  const [preparingMessage, setPreparingMessage] = useState('Checking MindGate AI...');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiThinking]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const focusInput = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const resetChatState = () => {
    setState('chat');
    setMessages([{ role: 'ai', content: DEFAULT_FIRST_MESSAGE, timestamp: Date.now() }]);
    setUserInput('');
    setAiResponse('');
    setRemainingAccessTime(null);
    setIsInputDisabled(false);
    setIsAiThinking(false);
  };

  useImperativeHandle(ref, () => ({
    resetChat: async () => {
      resetChatState();
      focusInput();
    },
  }), []);

  useEffect(() => {
    if (state === 'chat') {
      const timer = setTimeout(focusInput, 50);
      return () => clearTimeout(timer);
    }
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    const loadReadiness = async () => {
      const api = await waitForMindgateAPI(1000);
      if (cancelled || !api) {
        setPreparingMessage('MindGate bridge is starting.');
        return;
      }

      const bridgeStatus = await waitForBridgeStatus(1000);
      if (cancelled) return;
      if (!bridgeStatus?.ready) {
        setPreparingMessage('MindGate main process is starting.');
        setTimeout(loadReadiness, 500);
        return;
      }

      const pollReadiness = async () => {
        const readiness = await api.getAiReadinessStatus().catch(() => null);
        if (cancelled) return;

        setPreparingMessage(readiness?.message ?? 'MindGate AI is starting.');
        if (readiness?.ready) {
          setAiReadinessConfirmed(true);
          return;
        }

        setTimeout(pollReadiness, 500);
      };

      void pollReadiness();
    };

    void loadReadiness();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (aiReadinessConfirmed || state !== 'chat') return;

    let cancelled = false;
    const pollReadiness = async () => {
      const api = window.mindgateAPI;
      if (!api?.getAiReadinessStatus) return;
      const status = await api.getAiReadinessStatus().catch(() => null);
      if (cancelled || !status) return;
      setPreparingMessage(status.message);
      if (status.ready) {
        setIsAiReady(true);
        setAiReadinessConfirmed(true);
        setIsInputDisabled(false);
        focusInput();
      }
    };

    const timer = setInterval(pollReadiness, 1000);
    void pollReadiness();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [aiReadinessConfirmed, isAiReady, state]);

  useEffect(() => {
    if (state === 'approved' && remainingAccessTime !== null) {
      const timer = setInterval(() => {
        setRemainingAccessTime((t) => (t !== null ? Math.max(0, t - 1) : null));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, remainingAccessTime]);

  const showRetryMessage = async (message: string, inputToRestore = '', enableInput = true) => {
    setIsAiThinking(false);
    setMessages((prev) => [
      ...prev,
      { role: 'ai', content: message, timestamp: Date.now() },
    ]);
    if (inputToRestore) {
      setUserInput(inputToRestore);
    }
    setState(enableInput || isAiReady ? 'chat' : 'preparing');
    setIsInputDisabled(!enableInput);
    if (!enableInput) {
      setIsInputDisabled(true);
    }
    if (enableInput) {
      focusInput();
    }
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || isInputDisabled) return;
    if (!isAiReady) {
      await showRetryMessage(preparingMessage || 'MindGate AI is not ready yet.', userInput.trim(), false);
      return;
    }

    const input = userInput.trim();
    const api = window.mindgateAPI;
    if (!api) {
      await showRetryMessage('MindGate bridge is not responding. Restart the app if this continues.', input);
      return;
    }

    setIsInputDisabled(true);
    setIsAiThinking(true);
    setState('loading');
    setUserInput('');
    setMessages((prev) => [...prev, { role: 'user', content: input, timestamp: Date.now() }]);

    try {
      const result = await api.sendChatMessage(input);
      if (!result?.message) {
        await showRetryMessage('MindGate did not respond. Please try again.', input);
        return;
      }

      setIsAiThinking(false);

      if (result.isApproved === null && isConnectionMessage(result.message)) {
        await showRetryMessage(result.message, input, true);
        return;
      }

      if (result.isApproved === false && isConnectionMessage(result.message)) {
        await showRetryMessage(result.message, input, true);
        return;
      }

      if (result.message) {
        setMessages((prev) => [...prev, { role: 'ai', content: result.message, timestamp: Date.now() }]);
      }

      if (result.isApproved === true) {
        const mins = result.durationMinutes || 10;
        const durationSeconds = mins * 60;
        setAiResponse(`Access approved for ${mins} minutes`);
        setState('approved');
        try {
          await api.grantAccess(durationSeconds);
        } catch (err) {
          console.error('[Overlay] grantAccess failed:', err);
        }
        setRemainingAccessTime(durationSeconds);
        setTimeout(() => onClose(), APPROVAL_DISPLAY_MS);
      } else if (result.isApproved === false) {
        setAiResponse('Access denied');
        setState('denied');
        try {
          await api.closeDistraction();
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
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      const friendlyMessage = `Connection error: ${errorMsg}. Please try again.`;
      await showRetryMessage(friendlyMessage, input);
    }
  };

  const renderPreparing = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px', minHeight: 0 }}>
      <div className="glass-empty">
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>Preparing MindGate AI</div>
        <div style={{ fontSize: '13px', lineHeight: 1.4 }}>{preparingMessage}</div>
      </div>
      <div className="glass-divider" />
      <div style={{ fontSize: '12px', color: 'var(--text-secondary, #a8b0bd)' }}>
        MindGate will be ready as soon as Ollama and the model are warmed up.
      </div>
    </div>
  );

  const renderChat = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {!aiReadinessConfirmed && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #a8b0bd)', lineHeight: 1.4, padding: '0 2px' }}>
          {preparingMessage}
        </div>
      )}
      <div className="glass-message-container">
        {messages.length === 0 ? (
          <div className="glass-empty">
            {isAiThinking ? 'MindGate is thinking...' : DEFAULT_FIRST_MESSAGE}
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
          }}
          placeholder={aiReadinessConfirmed ? 'Tell me why you need access...' : preparingMessage || 'MindGate AI is starting...'}
          className="glass-input"
          disabled={!isAiReady || isInputDisabled}
          rows={1}
          autoFocus
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={!isAiReady || !userInput.trim() || isInputDisabled}
          className="glass-btn"
        >
          Send
        </button>
      </div>
    </div>
  );

  const renderApproved = () => (
    <div className="glass-result">
      <div className="glass-result-icon success">✓</div>
      <p>{aiResponse}</p>
    </div>
  );

  const renderDenied = () => (
    <div className="glass-result">
      <div className="glass-result-icon error">!</div>
      <p>{aiResponse}</p>
    </div>
  );

  const renderTakeover = () => (
    <TakeoverView configuration={configuration} onDismiss={onClose} />
  );

  const renderContent = () => {
    switch (state) {
      case 'preparing': return renderPreparing();
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
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '14px',
        pointerEvents: 'auto',
        zIndex: 2147483647,
      }}
    >
      <div className="glass-header">
        <div>
          <div className="glass-title">MindGate</div>
          <div className="glass-subtitle">Focus check-in</div>
        </div>
      </div>
      <div className="glass-divider" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{renderContent()}</div>
    </div>
  );
});

LiquidGlassOverlay.displayName = 'LiquidGlassOverlay';
