import { ChatMessage } from '../../types';
import '../../styles/glassmorphism.css';

interface MessageBubbleProps {
  message: ChatMessage;
  isTyping?: boolean;
}

export const MessageBubble = ({ message, isTyping }: MessageBubbleProps) => {
  const isUser = message.role === 'user';

  if (isTyping) {
    return (
      <div className="glass-bubble-ai">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34c759', animation: 'glassTyping 1.4s ease-in-out infinite' }}></span>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34c759', animation: 'glassTyping 1.4s ease-in-out infinite', animationDelay: '-0.16s' }}></span>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34c759', animation: 'glassTyping 1.4s ease-in-out infinite', animationDelay: '-0.32s' }}></span>
          </div>
          <span style={{ color: '#a1a1a6', fontSize: '12px' }}>Thinking...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={isUser ? 'glass-bubble-user' : 'glass-bubble-ai'}>
      <div>{message.content}</div>
    </div>
  );
};

export const MessageList = ({ messages, isAiThinking }: { messages: ChatMessage[]; isAiThinking: boolean }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px' }}>
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {isAiThinking && <MessageBubble message={{ role: 'ai', content: '', timestamp: Date.now() }} isTyping />}
    </div>
  );
};