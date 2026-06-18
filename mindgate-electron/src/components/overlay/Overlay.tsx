import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Configuration, ChatMessage } from '../../types';
import { TakeoverView } from '../takeover/TakeoverView';
import { MessageList } from './MessageBubble';
import { waitForMindgateAPI } from '../../utils/bridge';
import '../../styles/glassmorphism.css';

export interface OverlayHandle {
  resetChat: () => Promise<void>;
}

interface OverlayProps {
  configuration: Configuration | null;
  onClose: () => void;
}

type OverlayState = 'chat' | 'loading' | 'approved' | 'denied' | 'takeover';

const DEFAULT_FIRST_MESSAGE = 'What do you need access for?';
const APPROVAL_DISPLAY_MS = 2000;
const BRIDGE_STARTING_MESSAGE = 'MindGate is starting...';

const isConnectionMessage = (message: string) => {
  return /connection|ollama|starting|unavailable|not ready|try again/i.test(message);
};

export const LiquidGlassOverlay = forwardRef<OverlayHandle, OverlayProps>(({ 
  configuration, 
  onClose 
}, ref) => {
  const [state, setState] = useState<OverlayState>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [remainingAccessTime, setRemainingAccessTime] = useState<number | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isInputDisabled, setIsInputDisabled] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [bridgeMessage, setBridgeMessage] = useState(BRIDGE_STARTING_MESSAGE);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let mounted = true;

    const initializeBridge = async () => {
      const api = await waitForMindgateAPI();
      if (!mounted) return;

      setBridgeReady(Boolean(api));
      setBridgeMessage(api ? '' : BRIDGE_STARTING_MESSAGE);
    };

    void initializeBridge();

    return () => {
      mounted = false;
    };
  }, []);

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
    resetChatState();
  }, []);

  useEffect(() => {
    if (state === 'chat') {
      const timer = setTimeout(focusInput, 50);
      return () => clearTimeout(timer);
    }
  }, [state]);

  useEffect(() => {
    if (state === 'approved' && remainingAccessTime !== null) {
      const timer = setInterval(() => {
        setRemainingAccessTime((t) => (t !== null ? Math.max(0, t - 1) : null));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, remainingAccessTime]);

  const showRetryMessage = async (message: string) => {
    setIsAiThinking(false);
    setMessages((prev) => [
      ...prev,
      { role: 'ai', content: message, timestamp: Date.now() },
    ]);
    setState('chat');
    setIsInputDisabled(false);
    setBridgeMessage('');
    focusInput();
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || isInputDisabled) return;

    if (!bridgeReady) {
      setBridgeMessage(BRIDGE_STARTING_MESSAGE);
      return;
    }
    
    const input = userInput.trim();
    setUserInput('');
    setMessages((prev) => [...prev, { role: 'user', content: input, timestamp: Date.now() }]);
    setIsInputDisabled(true);
    setIsAiThinking(true);
    setState('loading');
    setBridgeMessage('');

    const api = await waitForMindgateAPI(5000);
    if (!api) {
      await showRetryMessage('MindGate is starting. Please try again in a moment.');
      return;
    }

    try {
      const result = await api.sendChatMessage(input);
      if (!result?.message) {
        await showRetryMessage('MindGate did not respond. Please try again.');
        return;
      }

      setIsAiThinking(false);
      setBridgeMessage('');

      if (result.isApproved === false && isConnectionMessage(result.message)) {
        await showRetryMessage(result.message);
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
      const friendlyMessage = errorMsg === 'Bridge unavailable'
        ? 'MindGate is starting. Please try again in a moment.'
        : `Connection error: ${errorMsg}. Please try again.`;
      await showRetryMessage(friendlyMessage);
    }
  };

  const renderChat = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="glass-message-container">
        {messages.length === 0 ? (
          <div className="glass-empty">
            {isAiThinking ? 'MindGate is thinking...' : (!bridgeReady ? bridgeMessage : DEFAULT_FIRST_MESSAGE)}
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
          placeholder={!bridgeReady ? 'MindGate is starting...' : 'Tell me why you need access...'}
          className="glass-input"
          disabled={isInputDisabled || !bridgeReady}
          rows={1}
          autoFocus
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={!bridgeReady || !userInput.trim() || isInputDisabled}
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
        padding: '16px',
        pointerEvents: 'auto',
        zIndex: 2147483647,
      }}
    >
      <div className="glass-header">
        <div>
          <div className="glass-title">MindGate</div>
          <div className="glass-subtitle">Focus check-in</div>
        </div>
        {!bridgeReady && <div className="glass-status">{bridgeMessage}</div>}
      </div>
      <div className="glass-divider" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{renderContent()}</div>
    </div>
  );
});

LiquidGlassOverlay.displayName = 'LiquidGlassOverlay';
