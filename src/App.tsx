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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000/api';

const App: React.FC = () => {
  const [view, setView] = useState<'voice' | 'chat'>('voice');
  const [messages, setMessages] = useState<Message[]>([]);
  const [micActive, setMicActive] = useState(false); // micrófono silenciado por defecto
  const [selectedVoice, setSelectedVoice] = useState<string>(voicesData[0]?.name || 'es-ES-AlvaroNeural');
  const [selectedLang, setSelectedLang] = useState<string>(voicesData[0]?.lang || 'es-ES');
  const [isTalking, setIsTalking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isFirstQuestion, setIsFirstQuestion] = useState(true);
  const [isMuted, setIsMuted] = useState(false); // NUEVO: estado global de mute
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
        setIsSpeaking(false);
      }
      setInputBuffer(text);
      if (inputTimeoutRef.current) {
        clearTimeout(inputTimeoutRef.current);
      }
      inputTimeoutRef.current = window.setTimeout(() => {
        const words = text.trim().split(/\s+/);
        if (words.length > 1 || text.length > 10) {
          addMessage('user', text, true);
          // Solo aquí se llama a sendToBackend, y solo ahí se activa el loader
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
    if (isProcessing) return;
    setIsProcessing(true); // Mostrar "Procesando..." en cada pregunta
    try {
      // Obtener toda la información institucional extendida
      const [resInfo, resLabs, resProd] = await Promise.all([
        fetch(`${BACKEND_URL}/info`),
        fetch(`${BACKEND_URL}/laboratorios`),
        fetch(`${BACKEND_URL}/produccion_cientifica`)
      ]);
      if (!resInfo.ok || !resLabs.ok || !resProd.ok) throw new Error('No se pudo obtener información institucional');
      const uchData = await resInfo.json();
      const laboratorios = await resLabs.json();
      const produccionCientifica = await resProd.json();
      // --- PROMPT para IA institucional ---
const prompt = `Eres un asistente virtual institucional de la Universidad de Ciencias y Humanidades (UCH). Responde siempre de manera cálida, cercana y natural, como lo haría una persona real, usando frases empáticas y amables. Si la pregunta es sobre la UCH, responde usando la información institucional proporcionada y sé específico sobre la UCH. Si la pregunta es académica, sobre carreras universitarias, servicios, vida universitaria, procesos de admisión, historia, facultades, laboratorios, producción científica, etc., puedes usar tu conocimiento general para dar una respuesta completa, clara, útil y amigable, siempre en el contexto de una universidad. Si la pregunta menciona otra universidad, responde que solo puedes dar información específica sobre la UCH. No saludes ni repitas saludos durante la conversación. No incluyas textos entre paréntesis en tus respuestas. Si el usuario pregunta si lo escuchas, responde de forma natural y humana, por ejemplo: '¡Sí, te escucho perfectamente! ¿En qué puedo ayudarte?'.

Información institucional completa:
${JSON.stringify(uchData)}

Laboratorios de investigación:
${JSON.stringify(laboratorios)}

Producción científica:
${JSON.stringify(produccionCientifica)}

Pregunta del usuario: ${text}`;
      // Guardar en historial temporal
      const updatedHistory = [...conversationHistory, { role: 'user', content: text }];
      setConversationHistory(updatedHistory);
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ text: prompt, history: updatedHistory })
      });
      const iaData = await response.json();
      let cleanResponse = iaData.response
        .replace(/\*/g, '')
        .replace(/https?:\/\S+/g, '')
        .replace(/http/gi, '')
        .replace(/www\.uch\.edu\.pe/gi, 'www.uch.edu.pe')
        .replace(/\s{2,}/g, ' ')
        .trim();
      addMessage('assistant', cleanResponse, fromVoice);
      setConversationHistory(prev => ([...prev, { role: 'assistant', content: cleanResponse }]));
      if (fromVoice) speak(cleanResponse);
      setIsProcessing(false); // Ocultar "Procesando..." al recibir respuesta
      if (isFirstQuestion) setIsFirstQuestion(false);
    } catch (err) {
      addMessage('assistant', 'No se pudo obtener información institucional.', fromVoice);
      setConversationHistory(prev => ([...prev, { role: 'assistant', content: 'No se pudo obtener información institucional.' }]));
      setIsProcessing(false); // Ocultar también en error
      if (isFirstQuestion) setIsFirstQuestion(false);
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
      const response = await fetch(`${BACKEND_URL}/tts`, {
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
      audio.playbackRate = 0.85;
      audio.muted = isMuted; // Asegura que el audio se mutee si está activado el mute
      setIsTalking(true);
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        setIsTalking(false);
        setTimeout(() => setIsProcessing(false), 1000); // Espera 1 segundo antes de ocultar el loader
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsTalking(false);
        setTimeout(() => setIsProcessing(false), 1000);
      };
      audio.play();
    } catch (error) {
      setIsSpeaking(false);
      setIsTalking(false);
      setTimeout(() => setIsProcessing(false), 1000);
      console.error('Error al obtener audio del backend:', error);
    }
  };

  // --- Mute global para el asistente (solo voz del asistente) ---
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted, isTalking]);

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

  return (
    <div style={{position:'relative'}}>
      {isProcessing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          pointerEvents: 'none'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.85)', 
            padding: '24px 48px',
            borderRadius: '18px',
            fontSize: '2.2rem',
            fontWeight: 'bold',
            color: '#1a237e',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            pointerEvents: 'none',
            userSelect: 'none',
            letterSpacing: '1px',
            border: '1.5px solid #e3e6f0',
            minWidth: '220px',
            textAlign: 'center'
          }}>
            Procesando...
          </div>
        </div>
      )}
      {view === 'voice' ? (
        <VoiceAssistantUI
          onClose={() => setView('chat')}
          micActive={micActive}
          onMicToggle={handleMicToggle}
          selectedVoice={selectedVoice}
          setSelectedVoice={setSelectedVoice}
          selectedLang={selectedLang}
          setSelectedLang={setSelectedLang}
          talking={isSpeaking}
          inputBuffer={inputBuffer}
          isMuted={isMuted} // NUEVO: pasar estado mute
          setIsMuted={setIsMuted} // NUEVO: pasar setter
        />
      ) : (
        <ChatView
          messages={messages}
          onSend={handleSendText}
          onReturnToVoice={() => setView('voice')}
          onClear={handleClear}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};

export default App;