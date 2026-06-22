import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Configuration, ChatMessage, BridgeStatus, AIReadinessStatus } from '../../types.js';
import { TakeoverView } from '../takeover/TakeoverView.js';
import { MessageList } from './MessageBubble.js';
import { waitForMindgateAPI } from '../../utils/bridge.js';
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

const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const LiquidGlassOverlay = forwardRef<OverlayHandle, OverlayProps>(({ 
  configuration, 
  onClose 
}, ref) => {
  const [state, setState] = useState<OverlayState>('preparing');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { role: 'ai', content: DEFAULT_FIRST_MESSAGE, timestamp: Date.now() },
  ]);
  const [userInput, setUserInput] = useState('');
  const [remainingAccessTime, setRemainingAccessTime] = useState<number | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isInputDisabled, setIsInputDisabled] = useState(true);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isAiReady, setIsAiReady] = useState(false);
  const [isBridgeReady, setIsBridgeReady] = useState(false);
  const [bridgeMessage, setBridgeMessage] = useState('Verifying MindGate bridge...');
  const [preparingMessage, setPreparingMessage] = useState(bridgeMessage);

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
    setState(isBridgeReady ? 'chat' : 'preparing');
    setMessages([{ role: 'ai', content: DEFAULT_FIRST_MESSAGE, timestamp: Date.now() }]);
    setUserInput('');
    setAiResponse('');
    setRemainingAccessTime(null);
    setIsInputDisabled(!isBridgeReady);
    setIsAiThinking(false);
  };

  useImperativeHandle(ref, () => ({
    resetChat: async () => {
      resetChatState();
      focusInput();
    },
  }), [isBridgeReady, isAiReady]);

  useEffect(() => {
    if (state === 'chat' && isBridgeReady) {
      const timer = setTimeout(focusInput, 50);
      return () => clearTimeout(timer);
    }
  }, [state, isBridgeReady]);

  useEffect(() => {
    let cancelled = false;
    let bridgeRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let aiPollTimer: ReturnType<typeof setTimeout> | null = null;

    const pollAiReadiness = async (api: Window['mindgateAPI']) => {
      if (cancelled) return;

      if (!api?.getAiReadinessStatus) {
        setPreparingMessage('MindGate AI status is not available yet.');
        setBridgeMessage('MindGate bridge is ready, but AI status is unavailable.');
        aiPollTimer = setTimeout(() => pollAiReadiness(api), 1000);
        return;
      }

      try {
        const readiness = await api.getAiReadinessStatus();
        if (cancelled) return;

        const statusMessage = readiness.message || 'MindGate AI is starting.';
        setPreparingMessage(statusMessage);
        setIsAiReady(readiness.ready);

        if (readiness.ready) {
          setIsInputDisabled(false);
          setState('chat');
          focusInput();
          return;
        }

        setIsInputDisabled(true);
        aiPollTimer = setTimeout(() => pollAiReadiness(api), 1000);
      } catch (error) {
        if (cancelled) return;
        const errMsg = formatError(error);
        setPreparingMessage(`AI status check failed: ${errMsg}`);
        setBridgeMessage(`AI status check failed: ${errMsg}`);
        aiPollTimer = setTimeout(() => pollAiReadiness(api), 1000);
      }
    };

    const waitForBridge = async () => {
      if (cancelled) return;

      const api = await waitForMindgateAPI(8000, 100);
      if (cancelled) return;

      if (!api) {
        setBridgeMessage('MindGate bridge API is not available yet. Ensure the MindGate desktop app is running and loaded.');
        setPreparingMessage('MindGate bridge API is not available yet. Ensure the MindGate desktop app is running and loaded.');
        setIsBridgeReady(false);
        bridgeRetryTimer = setTimeout(waitForBridge, 1000);
        return;
      }

      let bridgeStatus: BridgeStatus | null = null;
      try {
        bridgeStatus = await api.getBridgeStatus?.();
      } catch {
        bridgeStatus = null;
      }

      const ready = Boolean(bridgeStatus?.ready);
      setBridgeMessage(
        ready
          ? 'MindGate bridge is ready.'
          : 'MindGate bridge is still starting. Please wait a moment.',
      );
      setIsBridgeReady(ready);

      if (!ready) {
        bridgeRetryTimer = setTimeout(waitForBridge, 1000);
        return;
      }

      void pollAiReadiness(api);
    };

    void waitForBridge();

    return () => {
      cancelled = true;
      if (bridgeRetryTimer) clearTimeout(bridgeRetryTimer);
      if (aiPollTimer) clearTimeout(aiPollTimer);
    };
  }, []);

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

    const canInteract = enableInput && isBridgeReady;
    setState(canInteract ? 'chat' : 'preparing');
    setIsInputDisabled(!canInteract);
    setPreparingMessage(message);
    setBridgeMessage(message);
    if (canInteract) {
      focusInput();
    }
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || isInputDisabled) return;

    const input = userInput.trim();
    let api: Window['mindgateAPI'] | null = window.mindgateAPI ?? null;

    if (!api) {
      api = await waitForMindgateAPI(8000, 100);
      if (!api) {
        await showRetryMessage('MindGate bridge API is not available yet. Ensure the MindGate desktop app is running.', input, true);
        return;
      }
    }

    let bridgeStatus: BridgeStatus | null = null;
    try {
      bridgeStatus = await api.getBridgeStatus?.();
    } catch {
      bridgeStatus = null;
    }

    if (!bridgeStatus?.ready) {
      await showRetryMessage('MindGate bridge is still starting. Please wait a moment and try again.', input, true);
      return;
    }

    setIsInputDisabled(true);
    setIsAiThinking(true);

    let readiness: AIReadinessStatus | null = null;
    try {
      readiness = await api.getAiReadinessStatus();
    } catch {
      readiness = null;
    }

    if (!readiness?.ready) {
      setIsAiThinking(false);
      setIsAiReady(false);
      setState('loading');
      setUserInput('');

      const aiWait = async (): Promise<AIReadinessStatus | null> => {
        const start = Date.now();
        while (Date.now() - start < 20000) {
          try {
            const status = await api.getAiReadinessStatus();
            if (status?.ready) return status;
          } catch {
            // continue waiting
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        return null;
      };

      const finalReadiness = await aiWait();
      if (!finalReadiness) {
        const message = readiness?.message || 'MindGate AI is not ready yet. Please wait a moment.';
        await showRetryMessage(message, '', true);
        return;
      }

      setIsAiReady(true);
      setIsInputDisabled(false);
      setPreparingMessage(finalReadiness.message);
      setBridgeMessage(finalReadiness.message);
      await sendChatMessage(input, api);
      return;
    }

    await sendChatMessage(input, api);
  };

  const sendChatMessage = async (input: string, api: Window['mindgateAPI']) => {
    if (!api) return;

    setState('loading');
    setMessages((prev) => [...prev, { role: 'user', content: input, timestamp: Date.now() }]);
    setUserInput('');

    try {
      const result = await api.sendChatMessage(input);
      if (!result?.message) {
        await showRetryMessage('MindGate did not respond. Please try again.', '', true);
        return;
      }

      setIsAiThinking(false);

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
        setMessages((prev) => [...prev, { role: 'ai', content: result.message, timestamp: Date.now() }]);
        setState('chat');
        setIsInputDisabled(false);
        focusInput();
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      const friendlyMessage = `Connection error: ${errorMsg}. Please try again.`;
      await showRetryMessage(friendlyMessage, '', true);
    }
  };

  const renderPreparing = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px', minHeight: 0 }}>
      <div className="glass-empty">
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>{isBridgeReady ? 'Preparing MindGate AI' : 'Starting MindGate bridge'}</div>
        <div style={{ fontSize: '13px', lineHeight: 1.4 }}>{preparingMessage}</div>
      </div>
      <div className="glass-divider" />
      <div style={{ fontSize: '12px', color: 'var(--text-secondary, #a8b0bd)' }}>
        {isBridgeReady
          ? 'MindGate will be ready as soon as Ollama and the model are warmed up.'
          : 'The main process, overlay bridge, and monitoring services are still starting.'}
      </div>
    </div>
  );

  const renderChat = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {(!isAiReady || !isBridgeReady) && (
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
          placeholder={isAiReady ? 'Tell me why you need access...' : 'MindGate AI is warming up, please wait...'}
          className="glass-input"
          disabled={!isBridgeReady || isInputDisabled}
          rows={1}
          autoFocus
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={!isBridgeReady || isInputDisabled || !userInput.trim()}
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
