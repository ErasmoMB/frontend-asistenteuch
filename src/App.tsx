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
    // Solo activa el loader aquí, cuando realmente se envía la pregunta
    setIsProcessing(true);
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
      const prompt = `Eres un asistente institucional de la Universidad de Ciencias y Humanidades (UCH). Responde solo sobre la UCH, ignora otras universidades. Analiza cuidadosamente toda la siguiente información institucional (carreras, facultades, servicios, admisión, misión, visión, autoridades, laboratorios, producción científica, etc) y responde de forma clara, breve, natural y coherente, sin saludar ni leer textos entre paréntesis. Si la pregunta es sobre carreras, servicios, facultades, admisión, biblioteca, misión, visión, autoridades, historia, laboratorios o producción científica, responde solo en términos de la UCH y usando la información proporcionada. Si ya saludaste al inicio, no vuelvas a saludar hasta que termine la conversación.\n\nInformación institucional completa:\n${JSON.stringify(uchData)}\n\nLaboratorios de investigación:\n${JSON.stringify(laboratorios)}\n\nProducción científica:\n${JSON.stringify(produccionCientifica)}\n\nPregunta del usuario: ${text}`;
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
      else setIsProcessing(false);
    } catch (err) {
      addMessage('assistant', 'No se pudo obtener información institucional.', fromVoice);
      setConversationHistory(prev => ([...prev, { role: 'assistant', content: 'No se pudo obtener información institucional.' }]));
      if (fromVoice) setTimeout(() => setIsProcessing(false), 1000);
      else setIsProcessing(false);
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
    <div style={{position:'relative'}}>
      {/* Overlay de carga: visible si isProcessing y no isSpeaking */}
      {isProcessing && !isSpeaking && (
        <div style={{
          position:'fixed',
          top:0,
          left:0,
          width:'100vw',
          height:'100vh',
          background:'rgba(30,30,30,0.45)',
          zIndex:2000,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          flexDirection:'column',
        }}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <span className="loader" style={{width:48,height:48,border:'6px solid #4ec9b0',borderTop:'6px solid transparent',borderRadius:'50%',animation:'spin 1s linear infinite',display:'inline-block',marginBottom:16}}></span>
            <span style={{color:'#4ec9b0',fontWeight:'bold',fontSize:22,background:'rgba(0,0,0,0.15)',padding:'8px 24px',borderRadius:12}}>Cargando...</span>
          </div>
        </div>
      )}
      <VoiceAssistantUI
        onClose={() => setView('chat')}
        micActive={micActive}
        onMicToggle={handleMicToggle}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        selectedLang={selectedLang}
        setSelectedLang={setSelectedLang}
        talking={isSpeaking} // Solo mueve la boca cuando isSpeaking es true
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