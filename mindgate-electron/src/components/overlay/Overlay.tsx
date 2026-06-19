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

type OverlayState = 'chat' | 'loading' | 'approved' | 'denied' | 'takeover';

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
    if (state === 'approved' && remainingAccessTime !== null) {
      const timer = setInterval(() => {
        setRemainingAccessTime((t) => (t !== null ? Math.max(0, t - 1) : null));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, remainingAccessTime]);

  const showRetryMessage = async (message: string, inputToRestore = '') => {
    setIsAiThinking(false);
    setMessages((prev) => [
      ...prev,
      { role: 'ai', content: message, timestamp: Date.now() },
    ]);
    if (inputToRestore) {
      setUserInput(inputToRestore);
    }
    setState('chat');
    setIsInputDisabled(false);
    focusInput();
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || isInputDisabled) return;
    
    const input = userInput.trim();
    setIsInputDisabled(true);
    setIsAiThinking(true);
    setState('loading');

    const api = await waitForMindgateAPI(12000);
    if (!api) {
      await showRetryMessage('MindGate is still loading. Please try again in a moment.', input);
      return;
    }

    try {
      const pingResult = await api.ping();
      if (!pingResult) {
        await showRetryMessage('MindGate main process is still starting. Please try again in a moment.', input);
        return;
      }

      const bridgeStatus = await waitForBridgeStatus(3000);
      if (bridgeStatus && !bridgeStatus.ready) {
        const missing = [
          !bridgeStatus.configuration && 'configuration',
          !bridgeStatus.decisionEngine && 'AI engine',
          !bridgeStatus.windowManager && 'window manager',
          !bridgeStatus.workspaceMonitor && 'workspace monitor',
        ].filter(Boolean).join(', ');
        await showRetryMessage(`MindGate is still starting (${missing}). Please try again in a moment.`, input);
        return;
      }
    } catch (e) {
      console.warn('[Overlay] bridge readiness check failed:', e);
      await showRetryMessage('MindGate bridge is not responding yet. Please try again in a moment.', input);
      return;
    }

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
        await showRetryMessage(result.message, input);
        return;
      }

      if (result.isApproved === false && isConnectionMessage(result.message)) {
        await showRetryMessage(result.message, input);
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

  const renderChat = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
          placeholder="Tell me why you need access..."
          className="glass-input"
          disabled={isInputDisabled}
          rows={1}
          autoFocus
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={!userInput.trim() || isInputDisabled}
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
