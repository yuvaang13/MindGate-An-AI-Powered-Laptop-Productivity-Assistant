import React, { useState, useRef, useEffect } from 'react';
import { Configuration, ChatMessage } from '../../types';
import { TakeoverView } from '../takeover/TakeoverView';
import '../../styles/glassmorphism.css';

interface OverlayProps {
  visible: boolean;
  configuration: Configuration;
  onClose: () => void;
}

type OverlayState = 'chat' | 'loading' | 'approved' | 'denied' | 'takeover';

export const LiquidGlassOverlay: React.FC<OverlayProps> = ({ visible, configuration, onClose }) => {
  const [state, setState] = useState<OverlayState>('chat');
  console.log('[Overlay] Render — visible:', visible, 'state:', state);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(configuration.settings.justificationCountdownDuration);
  const [remainingAccessTime, setRemainingAccessTime] = useState<number | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isInputDisabled, setIsInputDisabled] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (visible) {
      setState('chat');
      setMessages([]);
      setUserInput('');
      setAiResponse('');
      setRemainingAccessTime(null);
      setIsInputDisabled(false);
      setCountdownSeconds(configuration.settings.justificationCountdownDuration);
      initChat();
    }
  }, [visible]);

  const initChat = async () => {
    try {
      window.mindgateAPI.resetChat();
      const firstMessage = await window.mindgateAPI.generateFirstMessage();
      setMessages([{ role: 'ai', content: firstMessage, timestamp: Date.now() }]);
    } catch {
      setMessages([{ role: 'ai', content: 'MindGate AI is not connected. Please start Ollama.', timestamp: Date.now() }]);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (state === 'chat') {
        if (countdownSeconds > 0) {
          setCountdownSeconds(s => s - 1);
        } else if (countdownSeconds === 0) {
          handleTimeout();
        }
      }

      if (state === 'approved' && remainingAccessTime !== null) {
        setRemainingAccessTime(t => t !== null ? Math.max(0, t - 1) : null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownSeconds, state, remainingAccessTime]);

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

  if (!visible) return null;

  const renderChat = () => (
    <>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        overflowY: 'auto',
        padding: '4px 2px',
        minHeight: 0,
      }}>
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'glass-bubble-user' : 'glass-bubble-ai'}>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="glass-divider" />

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
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
          rows={2}
          style={{ resize: 'none', flex: 1, minHeight: '40px', maxHeight: '80px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!userInput.trim() || isInputDisabled}
          className="glass-btn"
          style={{ height: '40px', padding: '0 16px', flexShrink: 0 }}
        >
          Send
        </button>
      </div>
    </>
  );

  const renderApproved = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <p style={{ fontSize: '16px', fontWeight: '600', color: '#30D158', textAlign: 'center', margin: 0 }}>
        {aiResponse}
      </p>
      {remainingAccessTime !== null && (
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', margin: 0 }}>
          Time remaining: {Math.floor(remainingAccessTime / 60)}m {remainingAccessTime % 60}s
        </p>
      )}
    </div>
  );

  const renderDenied = () => (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <p style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>{aiResponse}</p>
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
      className="glass-panel-dark"
      style={{
        position: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        top: 0,
        left: 0,
        width: '380px',
        height: '380px',
        padding: '20px',
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
          <span style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>
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
};
