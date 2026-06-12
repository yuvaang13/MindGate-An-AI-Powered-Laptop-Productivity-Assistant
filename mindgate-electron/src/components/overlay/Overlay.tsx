import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Configuration, ChatMessage } from '../../types';
import { TakeoverView } from '../takeover/TakeoverView';
import '../../styles/glassmorphism.css';

export interface OverlayHandle {
  resetChat: () => void;
}

interface OverlayProps {
  configuration: Configuration;
  onClose: () => void;
}

type OverlayState = 'chat' | 'loading' | 'approved' | 'denied' | 'takeover';

export const LiquidGlassOverlay = forwardRef<OverlayHandle, OverlayProps>(({ configuration, onClose }, ref) => {
  const [state, setState] = useState<OverlayState>('chat');
  console.log('[Overlay] Render — state:', state);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(configuration.settings.justificationCountdownDuration);
  const [remainingAccessTime, setRemainingAccessTime] = useState<number | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isInputDisabled, setIsInputDisabled] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const initChat = async () => {
    console.log('[Overlay] initChat — starting');
    if (!window.mindgateAPI) {
      console.warn('[Overlay] mindgateAPI not available — using fallback');
      setMessages([{ role: 'ai', content: "MindGate bridge not initialized. Please restart the app.", timestamp: Date.now() }]);
      setAiReady(true);
      return;
    }
    try {
      window.mindgateAPI.resetChat();
    } catch (e) {
      console.warn('[Overlay] resetChat failed:', e);
    }
    console.log('[Overlay] initChat — calling generateFirstMessage');
    let firstMessage = '';
    try {
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('AI response timed out after 5s')), 5000);
      });
      firstMessage = await Promise.race([
        window.mindgateAPI.generateFirstMessage(),
        timeoutPromise
      ]);
      console.log('[Overlay] initChat — generateFirstMessage returned:', firstMessage.slice(0, 80));
    } catch (e) {
      console.warn('[Overlay] initChat — using fallback message, error:', e);
      firstMessage = "I see you're trying to access a distracting website. Why do you need to be here?";
    }
    setMessages([{ role: 'ai', content: firstMessage, timestamp: Date.now() }]);
    setAiReady(true);
    console.log('[Overlay] initChat — done, aiReady=true');
  };

  useImperativeHandle(ref, () => ({
    resetChat: async () => {
      console.log('[Overlay] resetChat called');
      setState('chat');
      setMessages([]);
      setUserInput('');
      setAiResponse('');
      setRemainingAccessTime(null);
      setIsInputDisabled(false);
      setAiReady(false);
      setChatError(null);
      setIsRetrying(false);
      setCountdownSeconds(configuration.settings.justificationCountdownDuration);
      await initChat();
    }
  }), [configuration]);

  useEffect(() => {
    console.log('[Overlay] Mounted — starting initial chat');
    initChat();
  }, []);

  useEffect(() => {
    if (state === 'chat' && aiReady) {
      const timer = setInterval(() => {
        setCountdownSeconds(s => s - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, aiReady]);

  useEffect(() => {
    if (state === 'chat' && aiReady && countdownSeconds <= 0) {
      handleTimeout();
    }
  }, [countdownSeconds, state, aiReady]);

  useEffect(() => {
    if (state === 'approved' && remainingAccessTime !== null) {
      const timer = setInterval(() => {
        setRemainingAccessTime(t => t !== null ? Math.max(0, t - 1) : null);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, remainingAccessTime]);

  const handleTimeout = async () => {
    setIsInputDisabled(true);
    setMessages(prev => [...prev, { role: 'ai', content: "Time's up! Access denied.", timestamp: Date.now() }]);
    await window.mindgateAPI.closeDistraction();
    setTimeout(() => {
      setState('takeover');
    }, 1000);
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || isInputDisabled) return;

    const input = userInput.trim();
    setUserInput('');

    setMessages(prev => [...prev, { role: 'user', content: input, timestamp: Date.now() }]);

    setIsInputDisabled(true);
    setState('loading');

    try {
      const result = await window.mindgateAPI.sendChatMessage(input);

      if (result.message) {
        setMessages(prev => [...prev, { role: 'ai', content: result.message, timestamp: Date.now() }]);
      }

      if (result.isApproved === true) {
        const mins = result.durationMinutes || 10;
        setAiResponse(`Access approved for ${mins} minutes. Stay focused.`);
        setState('approved');
        window.mindgateAPI.grantAccess(mins * 60);
        setRemainingAccessTime(mins * 60);
        setTimeout(() => onClose(), 2500);
      } else if (result.isApproved === false) {
        setAiResponse('Access denied. Stay focused on your work.');
        setState('denied');
        await window.mindgateAPI.closeDistraction();
        setTimeout(() => setState('takeover'), 1500);
      } else {
        setState('chat');
        setIsInputDisabled(false);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'Error communicating with AI.', timestamp: Date.now() }]);
      setState('chat');
      setIsInputDisabled(false);
    }
  };

  const handleCountdownStyle = () => {
    const total = configuration.settings.justificationCountdownDuration;
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
      background: '#ffffff',
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
        {messages && messages.length > 0 ? messages.map((msg, i) => (
          <div key={i} className={msg?.role === 'user' ? 'glass-bubble-user' : 'glass-bubble-ai-light'}>
            {msg?.content ?? ''}
          </div>
        )) : chatError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px' }}>
            <div style={{ color: '#cc3b2e', fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>
              Connection Error
            </div>
            <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', lineHeight: 1.4 }}>
              {chatError}
            </div>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="glass-btn"
              style={{ padding: '8px 20px', fontSize: '13px' }}
            >
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px' }}>
            <div className="glass-dot" style={{ width: '10px', height: '10px' }} />
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
          onChange={e => setUserInput(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Explain why you need access..."
          className="glass-input"
          disabled={isInputDisabled}
          rows={1}
          style={{ resize: 'none', flex: 1, minHeight: '36px', maxHeight: '60px', fontSize: '13px' }}
        />
        <button
          onClick={handleSubmit}
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
      onDismiss={() => { onClose(); }}
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
        width: '280px',
        height: '280px',
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
