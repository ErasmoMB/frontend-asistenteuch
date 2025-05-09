import React, { useState, useRef } from 'react';
import VoiceAssistantUI from './components/VoiceAssistantUI';
import ChatView from './components/ChatView';

interface Message {
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  fromVoice?: boolean;
}

const BACKEND_URL = 'http://localhost:8000/api/chat';

const App: React.FC = () => {
  const [view, setView] = useState<'voice' | 'chat'>('voice');
  const [messages, setMessages] = useState<Message[]>([]);
  const [micActive, setMicActive] = useState(false); // micrófono silenciado por defecto
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef(window.speechSynthesis);
  const shouldKeepListening = useRef(false);

  // --- VOZ: Reconocimiento y síntesis ---
  const startRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz.');
      return;
    }
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      addMessage('user', text, true);
      await sendToBackend(text, true);
    };
    recognition.onerror = (event: any) => {
      // Solo silenciar si el usuario lo hizo manualmente
      if (!shouldKeepListening.current) setMicActive(false);
    };
    recognition.onend = () => {
      // Si el usuario no ha silenciado manualmente, seguir escuchando
      if (shouldKeepListening.current) {
        startRecognition();
      } else {
        setMicActive(false);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecognition = () => {
    shouldKeepListening.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  };

  // --- Mensajes ---
  const addMessage = (type: 'user' | 'assistant', text: string, fromVoice = false) => {
    setMessages(prev => ([...prev, { type, text, timestamp: new Date(), fromVoice }]));
  };

  // --- Enviar pregunta al backend ---
  const sendToBackend = async (text: string, fromVoice = false) => {
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      if (data && data.response) {
        addMessage('assistant', data.response, fromVoice);
        if (fromVoice) speak(data.response);
      } else {
        addMessage('assistant', 'No se pudo obtener respuesta de la IA.', fromVoice);
      }
    } catch (error) {
      addMessage('assistant', 'Error de conexión con el backend.', fromVoice);
    }
  };

  // --- Síntesis de voz ---
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    synthRef.current.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = 'es-ES';
    synthRef.current.speak(utter);
  };

  // --- Limpiar historial ---
  const handleClear = () => setMessages([]);

  // --- Handlers para UI ---
  const handleMicToggle = () => {
    if (micActive) {
      shouldKeepListening.current = false;
      stopRecognition();
      setMicActive(false);
    } else {
      shouldKeepListening.current = true;
      setMicActive(true);
      startRecognition();
    }
  };

  const handleSendText = (text: string) => {
    addMessage('user', text, false);
    sendToBackend(text, false);
  };

  return view === 'voice' ? (
    <VoiceAssistantUI
      onClose={() => setView('chat')}
      micActive={micActive}
      onMicToggle={handleMicToggle}
    />
  ) : (
    <ChatView
      messages={messages}
      onSend={handleSendText}
      onReturnToVoice={() => setView('voice')}
      onClear={handleClear}
    />
  );
};

export default App;
