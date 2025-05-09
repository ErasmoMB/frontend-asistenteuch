import React, { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

interface LogMessage {
  type: 'system' | 'user' | 'assistant' | 'error';
  text: string;
  timestamp: Date;
}

const ChatWindow: React.FC = () => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition({
    continuous: true,
    language: 'es-ES',
    interimResults: false
  });

  const addLog = (type: LogMessage['type'], text: string) => {
    setLogs(prev => [...prev, { type, text, timestamp: new Date() }]);
  };

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const speak = (text: string) => {
    console.log('Intentando leer texto:', text);
    
    // Asegurarnos de que la API de síntesis de voz está disponible
    if (!window.speechSynthesis) {
      console.error('La síntesis de voz no está soportada en este navegador');
      return;
    }

    // Detener cualquier síntesis de voz anterior
    window.speechSynthesis.cancel();

    // Crear y configurar el utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Agregar eventos para debugging
    utterance.onstart = () => console.log('Comenzando a hablar:', text);
    utterance.onend = () => console.log('Terminó de hablar:', text);
    utterance.onerror = (event) => console.error('Error en síntesis de voz:', event);

    // Intentar leer el texto
    try {
      window.speechSynthesis.speak(utterance);
      console.log('Texto enviado a síntesis de voz:', text);
    } catch (error) {
      console.error('Error al leer texto:', error);
    }
  };

  // Efecto para iniciar el reconocimiento de voz y la síntesis
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      addLog('error', 'Tu navegador no soporta el reconocimiento de voz.');
      return;
    }

    if (!isInitialized) {
      try {
        // Iniciar reconocimiento de voz
        SpeechRecognition.startListening({ 
          continuous: true,
          language: 'es-ES',
          interimResults: false
        });

        // Mostrar y leer el mensaje de bienvenida
        const welcomeMessage = 'Hola, soy tu asistente virtual. ¿En qué puedo ayudarte?';
        addLog('system', 'Iniciando asistente...');
        addLog('assistant', welcomeMessage);
        
        // Pequeño retraso para asegurar que la voz funcione
        setTimeout(() => {
          speak(welcomeMessage);
        }, 1000);

        setIsInitialized(true);
      } catch (error) {
        console.error('Error al iniciar:', error);
        addLog('error', 'Error al iniciar el asistente.');
      }
    }

    return () => {
      SpeechRecognition.stopListening();
    };
  }, [browserSupportsSpeechRecognition, isInitialized]);

  // Efecto para reiniciar el reconocimiento si se detiene
  useEffect(() => {
    if (isInitialized && !listening) {
      console.log('Reiniciando reconocimiento de voz...');
      SpeechRecognition.startListening({ 
        continuous: true,
        language: 'es-ES',
        interimResults: false
      });
    }
  }, [listening, isInitialized]);

  // Efecto para procesar el texto reconocido
  useEffect(() => {
    if (transcript && transcript.trim() !== '' && !isProcessing) {
      // Limpiar el timeout anterior si existe
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Esperar 1 segundo después de la última palabra antes de procesar
      timeoutRef.current = setTimeout(() => {
        console.log('Texto reconocido:', transcript);
        const text = transcript.toLowerCase();
        addLog('user', text);
        setIsProcessing(true);
        sendToBackend(text);
        resetTranscript();
      }, 1000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [transcript, isProcessing]);

  const sendToBackend = async (text: string) => {
    try {
      console.log('Enviando al backend:', text);
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error del backend:', errorData);
        throw new Error(errorData.detail || 'Error en la comunicación con el backend');
      }

      const data = await response.json();
      console.log('Respuesta del backend:', data);
      
      if (!data.response) {
        throw new Error('La respuesta del backend no tiene el formato esperado');
      }

      addLog('assistant', data.response);
      speak(data.response);
    } catch (error) {
      console.error('Error completo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addLog('error', `Error: ${errorMessage}`);
      speak('Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Función de prueba para la síntesis de voz
  const testVoice = () => {
    speak('Esta es una prueba de voz. ¿Me puedes escuchar?');
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1e1e1e',
      color: '#fff',
      fontFamily: 'monospace',
      padding: '20px',
      overflow: 'auto'
    }}>
      <button 
        onClick={testVoice}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '10px',
          backgroundColor: '#4ec9b0',
          color: '#1e1e1e',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          zIndex: 1000
        }}
      >
        Probar Voz
      </button>
      <div style={{ whiteSpace: 'pre-wrap' }}>
        {logs.map((log, index) => (
          <div key={index} style={{
            marginBottom: '8px',
            color: log.type === 'user' ? '#4ec9b0' :
                   log.type === 'assistant' ? '#569cd6' :
                   log.type === 'error' ? '#f14c4c' :
                   '#dcdcdc'
          }}>
            {`[${log.timestamp.toLocaleTimeString()}] ${
              log.type === 'user' ? 'Tú' :
              log.type === 'assistant' ? 'Asistente' :
              log.type === 'error' ? 'Error' :
              'Sistema'
            }: ${log.text}`}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default ChatWindow;