import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Configuration, ChatMessage } from '../../types';
import { TakeoverView } from '../takeover/TakeoverView';
import '../../styles/glassmorphism.css';

export interface OverlayHandle {
  resetChat: () => Promise<void>;
}

interface OverlayProps {
  configuration: Configuration | null;
  onClose: () => void;
}

type OverlayState = 'chat' | 'loading' | 'approved' | 'denied' | 'takeover';

const AI_INIT_TIMEOUT_MS = 8000;
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
  const apiReadyRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const waitForMindgateAPI = async (maxWaitMs = 15000): Promise<boolean> => {
    // Wait for preload-ready-ack acknowledgment
    const preloadReady = (window as unknown as { __preloadReady?: Promise<void> }).__preloadReady;
    if (preloadReady) {
      console.log('[Overlay] Waiting for preload-ready-ack...');
      await Promise.race([
        preloadReady,
        new Promise((_, reject) => setTimeout(() => reject(new Error('preload timeout')), maxWaitMs - 1000)),
      ]).catch(() => {}); // Ignore timeout, fall through to polling
    }

    return new Promise((resolve) => {
      if (window.mindgateAPI) {
        apiReadyRef.current = true;
        resolve(true);
        return;
      }

      // Check periodically for API availability
      const pollInterval = setInterval(() => {
        if (window.mindgateAPI) {
          apiReadyRef.current = true;
          clearInterval(pollInterval);
          resolve(true);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(pollInterval);
        console.error('[Overlay] mindgateAPI not available after waiting. window object:', Object.keys(window).filter((k) => k.includes('mindgate')));
        resolve(!!window.mindgateAPI);
      }, maxWaitMs);
    });
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for focus-input event from main process
  useEffect(() => {
    const handleFocusInput = () => {
      if (inputRef.current && !isInputDisabled) {
        inputRef.current.focus();
      }
    };
    window.addEventListener('mindgate-focus-input', handleFocusInput);
    return () => window.removeEventListener('mindgate-focus-input', handleFocusInput);
  }, [isInputDisabled]);

  const initChat = async () => {
    const apiReady = await waitForMindgateAPI();
    if (!apiReady) {
      setMessages([{
        role: 'ai',
        content: 'MindGate bridge not initialized. Please restart the app.',
        timestamp: Date.now(),
      }]);
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
    setAiReady(true);
    setTimeout(() => {
      if (inputRef.current && !isInputDisabled) {
        inputRef.current.focus();
      }
    }, 100);
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
  }, []); // Run once on mount

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
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      borderRadius: 'var(--glass-radius-md)',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        overflowY: 'auto',
        padding: '8px',
        minHeight: 0,
      }}>
{messages.length > 0 ? (
           <>
             {messages.map((msg, i) => (
               <div key={i} className={msg?.role === 'user' ? 'glass-bubble-user' : 'glass-bubble-ai-light'}>
                 {msg?.content ?? ''}
               </div>
             ))}
             {state === 'loading' && (
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px' }}>
                 <div className="glass-dot glass-dot-active" style={{ width: '8px', height: '8px' }} />
                 <span style={{ color: '#666', fontSize: '12px' }}>MindGate is thinking...</span>
               </div>
             )}
           </>
         ) : chatError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px' }}>
            <div style={{ color: '#cc3b2e', fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>
              Connection Error
            </div>
            <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', lineHeight: 1.4 }}>
              {chatError}
            </div>
            <button
              onClick={() => void handleRetry()}
              disabled={isRetrying}
              className="glass-btn"
              style={{ padding: '8px 20px', fontSize: '13px' }}
            >
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px' }}>
            <div className="glass-dot glass-dot-active" style={{ width: '10px', height: '10px' }} />
            <div style={{ color: '#1c1c1e', fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>
              Initializing AI...
            </div>
            <div style={{ color: '#666', fontSize: '12px', textAlign: 'center' }}>
              Connecting to MindGate AI
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="glass-divider" style={{ margin: '0 8px' }} />

      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', padding: '8px' }}>
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
           placeholder="Explain why you need access..."
           className="glass-input"
           disabled={isInputDisabled}
           rows={1}
           autoFocus
           style={{ resize: 'none', flex: 1, minHeight: '36px', maxHeight: '60px', fontSize: '13px' }}
         />
        <button
          onClick={() => void handleSubmit()}
          disabled={!userInput.trim() || isInputDisabled || !!chatError}
          className="glass-btn"
          style={{ height: '36px', padding: '0 14px', flexShrink: 0, fontSize: '13px' }}
        >
          Send
        </button>
      </div>
    </div>
  );

  const renderApproved = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <p style={{ fontSize: '16px', fontWeight: '600', color: '#30D158', textAlign: 'center', margin: 0 }}>
        {aiResponse}
      </p>
      {remainingAccessTime !== null && (
        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', textAlign: 'center', margin: 0 }}>
          Time remaining: {Math.floor(remainingAccessTime / 60)}m {remainingAccessTime % 60}s
        </p>
      )}
    </div>
  );

  const renderDenied = () => (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--glass-text)', margin: 0 }}>{aiResponse}</p>
    </div>
  );

  const renderTakeover = () => (
    <TakeoverView
      configuration={configuration}
      onDismiss={onClose}
    />
  );

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return renderChat();
      case 'approved':
        return renderApproved();
      case 'denied':
        return renderDenied();
      case 'takeover':
        return renderTakeover();
      default:
        return renderChat();
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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`glass-dot ${state === 'chat' || state === 'loading' ? 'glass-dot-active' : ''}`} />
          <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--glass-text)' }}>
            MindGate
          </span>
        </div>
        {state === 'chat' && (
          <span className="glass-countdown" style={handleCountdownStyle()}>
            {countdownSeconds}s
          </span>
        )}
      </div>
      <div className="glass-divider" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {renderContent()}
      </div>
    </div>
  );
});

LiquidGlassOverlay.displayName = 'LiquidGlassOverlay';
