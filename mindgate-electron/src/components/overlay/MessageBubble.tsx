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
      <div className="glass-bubble-ai-light">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="glass-typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span style={{ color: '#666', fontSize: '13px' }}>MindGate is thinking...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={isUser ? 'glass-bubble-user' : 'glass-bubble-ai-light'}>
      <div>{message.content}</div>
    </div>
  );
};

export const MessageList = ({ messages, isAiThinking }: { messages: ChatMessage[]; isAiThinking: boolean }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {isAiThinking && <MessageBubble message={{ role: 'ai', content: '', timestamp: Date.now() }} isTyping />}
    </div>
  );
};