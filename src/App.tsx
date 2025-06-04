import React, { useState, useRef } from 'react';
import VoiceAssistantUI from './components/VoiceAssistantUI';
import ChatView from './components/ChatView';
import voicesDataRaw from './assets/voices.json';

interface Message {
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  fromVoice?: boolean;
}

interface VoiceOption {
  name: string;
  label: string;
  lang: string;
}
const voicesData: VoiceOption[] = voicesDataRaw as VoiceOption[];

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000/api/chat';

const App: React.FC = () => {
  const [view, setView] = useState<'voice' | 'chat'>('voice');
  const [messages, setMessages] = useState<Message[]>([]);
  const [micActive, setMicActive] = useState(false); // micrófono silenciado por defecto
  const [selectedVoice, setSelectedVoice] = useState<string>(voicesData[0]?.name || 'es-ES-AlvaroNeural');
  const [selectedLang, setSelectedLang] = useState<string>(voicesData[0]?.lang || 'es-ES');
  const [isTalking, setIsTalking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef(window.speechSynthesis);
  const shouldKeepListening = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [conversationHistory, setConversationHistory] = useState<{role: string, content: string}[]>([]);
  const [inputBuffer, setInputBuffer] = useState("");
  const inputTimeoutRef = useRef<number | null>(null);

  // --- VOZ: Reconocimiento y síntesis ---
  const startRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz.');
      return;
    }
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'es-ES';
    recognition.continuous = true; // Mantener activo
    recognition.interimResults = true; // Resultados intermedios
    let speechStarted = false;
    recognition.onspeechstart = () => {
      speechStarted = true;
      if (inputTimeoutRef.current) {
        clearTimeout(inputTimeoutRef.current);
        inputTimeoutRef.current = null;
      }
    };
    recognition.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const text = event.results[lastResultIndex][0].transcript;
      // Silenciar IA apenas detecte que el usuario empieza a hablar (en cada resultado intermedio)
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsTalking(false);
      }
      setInputBuffer(text);
      if (inputTimeoutRef.current) {
        clearTimeout(inputTimeoutRef.current);
      }
      inputTimeoutRef.current = window.setTimeout(() => {
        const words = text.trim().split(/\s+/);
        if (words.length > 1 || text.length > 10) {
          addMessage('user', text, true);
          sendToBackend(text, true);
          setInputBuffer("");
        } else {
          setInputBuffer("");
        }
        inputTimeoutRef.current = null;
      }, 1500); // 1.5s de silencio
    };
    recognition.onspeechend = () => {
      speechStarted = false;
    };
    recognition.onerror = (event: any) => {
      if (!shouldKeepListening.current) setMicActive(false);
    };
    recognition.onend = () => {
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
    // --- Lógica de consulta a la API institucional ---
    const lowerText = text.toLowerCase();
    const match = UCH_KEYWORDS.find(({ key }) => lowerText.includes(key) || lowerText.includes('uch') || lowerText.includes('universidad de ciencias y humanidades'));
    if (match) {
      try {
        const res = await fetch(`${UCH_API_BASE}${match.endpoint}`);
        if (!res.ok) throw new Error('No se pudo obtener datos institucionales');
        const data = await res.json();
        // --- PROMPT para IA institucional ---
        const prompt = `Eres un asistente institucional de la Universidad de Ciencias y Humanidades (UCH). Responde solo sobre la UCH, ignora otras universidades. Analiza la siguiente información y responde de forma clara, breve y natural, sin saludar ni leer textos entre paréntesis. Si la pregunta es sobre carreras, servicios, facultades, admisión o biblioteca, responde solo en términos de la UCH. Si ya saludaste al inicio, no vuelvas a saludar hasta que termine la conversación.\n\nInformación institucional:\n${JSON.stringify(data)}\n\nPregunta del usuario: ${text}`;
        // Enviar prompt especial al backend de IA
        const updatedHistory = [...conversationHistory, { role: 'user', content: text }];
        setConversationHistory(updatedHistory);
        const response = await fetch(BACKEND_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ text: prompt, history: updatedHistory })
        });
        const iaData = await response.json();
        let cleanResponse = iaData.response
          .replace(/\s*(:[\w-]+|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEFF]|\uD83E[\uDD00-\uDDFF])/g, '')
          .replace(/(cara sonriente|emoji de [^.,;\s]+)/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
        addMessage('assistant', cleanResponse, fromVoice);
        setConversationHistory(prev => ([...prev, { role: 'assistant', content: cleanResponse }]));
        if (fromVoice) speak(cleanResponse);
        return;
      } catch (err) {
        addMessage('assistant', 'No se pudo obtener información institucional.', fromVoice);
        setConversationHistory(prev => ([...prev, { role: 'assistant', content: 'No se pudo obtener información institucional.' }]));
        if (fromVoice) speak('No se pudo obtener información institucional.');
        return;
      }
    }
    // --- Fin lógica API institucional ---
    // Guardar en historial temporal
    const updatedHistory = [...conversationHistory, { role: 'user', content: text }];
    setConversationHistory(updatedHistory);
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ text, history: updatedHistory }) // Enviar historial actualizado
      });
      const data = await response.json();
      if (data && data.response) {
        // Filtrar respuesta para eliminar descripciones de emojis y humanizar
        let cleanResponse = data.response
          .replace(/\s*(:[\w-]+|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEFF]|\uD83E[\uDD00-\uDDFF])/g, '') // elimina emojis
          .replace(/(cara sonriente|emoji de [^.,;\s]+)/gi, '') // elimina descripciones
          .replace(/\s{2,}/g, ' ')
          .trim();
        addMessage('assistant', cleanResponse, fromVoice);
        setConversationHistory(prev => ([...prev, { role: 'assistant', content: cleanResponse }]));
        if (fromVoice) speak(cleanResponse);
      } else {
        console.error('Respuesta del backend:', data);
        addMessage('assistant', 'No se pudo obtener respuesta de la IA.', fromVoice);
      }
    } catch (error) {
      console.error('Error completo:', error);
      addMessage('assistant', 'Error de conexión con el backend.', fromVoice);
    }
  };

  // --- Síntesis de voz con backend (control de interrupción y velocidad) ---
  const speak = async (text: string) => {
    try {
      // Detener audio anterior si existe
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsTalking(false);
      }
      const response = await fetch('http://localhost:8000/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: selectedVoice, lang: selectedLang })
      });
      if (!response.ok) {
        throw new Error('No se pudo obtener el audio del backend');
      }
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.playbackRate = 0.85; // Reproduce más lento para simular habla natural
      setIsTalking(true);
      audio.onended = () => setIsTalking(false);
      audio.onerror = () => setIsTalking(false);
      audio.play();
    } catch (error) {
      setIsTalking(false);
      console.error('Error al obtener audio del backend:', error);
    }
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
    <div>
      <VoiceAssistantUI
        onClose={() => setView('chat')}
        micActive={micActive}
        onMicToggle={handleMicToggle}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        selectedLang={selectedLang}
        setSelectedLang={setSelectedLang}
        talking={isTalking}
        inputBuffer={inputBuffer}
      />
    </div>
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

// Palabras clave y endpoints de la API institucional
const UCH_API_BASE = 'http://localhost:8000/api'; // Cambia a tu dominio si es necesario
const UCH_KEYWORDS = [
  { key: 'carreras', endpoint: '/carreras', label: 'carreras' },
  { key: 'facultades', endpoint: '/facultades', label: 'facultades' },
  { key: 'servicios', endpoint: '/servicios', label: 'servicios' },
  { key: 'admisión', endpoint: '/admision', label: 'admisión' },
  { key: 'admision', endpoint: '/admision', label: 'admisión' },
  { key: 'modalidad', endpoint: '/admision', label: 'modalidades' },
  { key: 'modalidades', endpoint: '/admision', label: 'modalidades' },
  { key: 'biblioteca', endpoint: '/servicios', label: 'biblioteca' },
];