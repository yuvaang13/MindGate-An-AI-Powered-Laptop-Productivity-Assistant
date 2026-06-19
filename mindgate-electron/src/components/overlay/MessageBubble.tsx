import { ChatMessage } from '../../types.js';
import '../../styles/glassmorphism.css';

interface MessageBubbleProps {
  message: ChatMessage;
  isTyping?: boolean;
}

export const MessageBubble = ({ message, isTyping }: MessageBubbleProps) => {
  const isUser = message.role === 'user';

  if (isTyping) {
    return (
      <div className="glass-bubble-ai glass-bubble-typing">
        <div className="glass-typing-row">
          <div className="glass-typing-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span>MindGate is thinking...</span>
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
    <div className="glass-message-list">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {isAiThinking && <MessageBubble message={{ role: 'ai', content: '', timestamp: Date.now() }} isTyping />}
    </div>
  );
};
