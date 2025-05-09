import React, { useRef, useEffect } from 'react';
import './ChatView.css';

interface Message {
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface ChatViewProps {
  messages: Message[];
  onSend: (text: string) => void;
  onReturnToVoice: () => void;
  onClear: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ messages, onSend, onReturnToVoice, onClear }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (value) {
      onSend(value);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="chatgpt-chat-container">
      {/* Header */}
      <div className="chatgpt-header">
        <span className="chatgpt-title">ChatGPT</span>
        <span className="chatgpt-trash-icon" title="Eliminar conversación" onClick={onClear}>🗑️</span>
        <span className="chatgpt-menu-icon">⋮</span>
      </div>
      {/* Mensajes */}
      <div className="chatgpt-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chatgpt-bubble chatgpt-bubble-${msg.type}`}> 
            <span className="chatgpt-bubble-text">{msg.text}</span>
            {msg.type === 'assistant' && (
              <div className="chatgpt-bubble-actions">
                <span title="Copiar">📋</span>
                <span title="Me gusta">👍</span>
                <span title="No me gusta">👎</span>
                <span title="Repetir">🔄</span>
              </div>
            )}
            <span className="chatgpt-bubble-time">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {/* Input, botón de enviar y micrófono */}
      <form className="chatgpt-input-bar" onSubmit={handleSend}>
        <input
          ref={inputRef}
          className="chatgpt-input"
          type="text"
          placeholder="Pregunta lo que quieras"
          autoComplete="off"
        />
        <button type="button" className="chatgpt-send-btn" title="Enviar" onClick={handleSend}>
          <span role="img" aria-label="enviar">📤</span>
        </button>
        <button type="button" className="chatgpt-mic-btn" onClick={onReturnToVoice} title="Volver al asistente de voz">
          <span role="img" aria-label="mic">🎤</span>
        </button>
      </form>
    </div>
  );
};

export default ChatView; 