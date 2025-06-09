import React from 'react';
import './VoiceAssistantUI.css';
import { FaInfoCircle, FaVolumeUp, FaVolumeMute, FaSlidersH, FaMicrophone, FaMicrophoneSlash, FaTimes } from 'react-icons/fa';
import AnimatedAvatar from './AnimatedAvatar';
import voicesDataRaw from '../assets/voices.json';

// Definir el tipo de voz
interface VoiceOption {
  name: string;
  label: string;
  lang: string;
}

const voicesData: VoiceOption[] = voicesDataRaw as VoiceOption[];

interface VoiceAssistantUIProps {
  onClose: () => void;
  micActive: boolean;
  onMicToggle: () => void;
  selectedVoice: string;
  setSelectedVoice: (voice: string) => void;
  selectedLang: string;
  setSelectedLang: (lang: string) => void;
  talking: boolean;
  inputBuffer?: string;
  isMuted: boolean; // NUEVO: para controlar mute desde App
  setIsMuted: (muted: boolean) => void; // NUEVO: para cambiar mute desde UI
}

const VoiceAssistantUI: React.FC<VoiceAssistantUIProps> = ({ onClose, micActive, onMicToggle, selectedVoice, setSelectedVoice, selectedLang, setSelectedLang, talking, inputBuffer, isMuted, setIsMuted }) => {
  const [showConfig, setShowConfig] = React.useState(false);
  const [showInfo, setShowInfo] = React.useState(false);

  // Silenciar/activar sonido del avatar (audio del navegador)
  React.useEffect(() => {
    // Silencia todos los elementos de audio globalmente
    const audios = document.querySelectorAll('audio');
    audios.forEach(audio => {
      audio.muted = isMuted;
    });
  }, [isMuted, talking]);

  // Filtrar idiomas únicos
  const languages: string[] = Array.from(new Set(voicesData.map((v: VoiceOption) => v.lang)));
  // Filtrar voces por idioma seleccionado
  const filteredVoices: VoiceOption[] = voicesData.filter((v: VoiceOption) => v.lang === selectedLang);

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLang(e.target.value);
    // Cambiar voz automáticamente a la primera del idioma
    const firstVoice = voicesData.find((v: VoiceOption) => v.lang === e.target.value);
    if (firstVoice) {
      setSelectedVoice(firstVoice.name);
      console.log(`Idioma seleccionado: ${e.target.value}, Voz aplicada: ${firstVoice.name}`);
    }
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVoice(e.target.value);
    console.log(`Voz seleccionada: ${e.target.value}`);
  };

  return (
    <div className="va-container" style={{
      backgroundImage: 'url(/fondo.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      minHeight: '100vh',
      minWidth: '100vw',
      position: 'relative',
    }}>
      {/* Iconos arriba derecha */}
      <div className="va-top-icons">
        <FaInfoCircle className="va-icon" title="Información" onClick={() => setShowInfo(true)} />
        {!isMuted ? (
          <FaVolumeUp className="va-icon va-icon-btn" title="Silenciar voz" onClick={() => setIsMuted(true)} />
        ) : (
          <FaVolumeMute className="va-icon va-icon-btn" title="Activar voz" onClick={() => setIsMuted(false)} />
        )}
        <FaSlidersH className="va-icon" title="Configuración" onClick={() => setShowConfig(true)} />
      </div>

      {/* Modal de información */}
      {showInfo && (
        <div className="va-modal-bg" onClick={() => setShowInfo(false)}>
          <div className="va-modal" onClick={e => e.stopPropagation()} style={{textAlign:'center'}}>
            <h3>Chatbot institucional de la UCH</h3>
            <button className="va-btn va-save-btn" onClick={() => setShowInfo(false)} style={{marginTop:16}}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Modal de configuración de voz/idioma */}
      {showConfig && (
        <div className="va-modal-bg" onClick={() => setShowConfig(false)}>
          <div className="va-modal" onClick={e => e.stopPropagation()}>
            <h3>Configuración de Voz e Idioma</h3>
            <label>Idioma:
              <select value={selectedLang} onChange={handleLangChange}>
                {languages.map((lang: string) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </label>
            <label>Voz:
              <select value={selectedVoice} onChange={handleVoiceChange}>
                {filteredVoices.map((voice: VoiceOption) => (
                  <option key={voice.name} value={voice.name}>{voice.label}</option>
                ))}
              </select>
            </label>
            <button className="va-btn va-save-btn" onClick={() => setShowConfig(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Imagen central */}
      <div className="va-center-circle" style={{
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Círculo de fondo grande detrás del avatar */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90vw',
            height: '90vw',
            maxWidth: 800,
            maxHeight: 800,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)',
            boxShadow: '0 0 120px 40px #00bfff88, 0 0 0 20px #222',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
        <AnimatedAvatar talking={talking} />
      </div>

      {/* Botones inferiores */}
      <div className="va-bottom-buttons">
        <button
          className={`va-btn va-mic-btn${micActive ? '' : ' va-mic-off'}`}
          onClick={onMicToggle}
          title={micActive ? 'Silenciar micrófono' : 'Activar micrófono'}
        >
          {micActive ? <FaMicrophone size={28} /> : <FaMicrophoneSlash size={28} />}
        </button>
        <button
          className="va-btn va-close-btn"
          title="Cerrar asistente"
          onClick={onClose}
        >
          <FaTimes size={28} />
        </button>
      </div>

      {/* Mostrar buffer de entrada de voz si está activo */}
      {inputBuffer && (
        <div className="input-buffer" style={{ position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)', background: '#fff', color: '#222', borderRadius: 12, padding: '8px 18px', boxShadow: '0 2px 12px #0002', zIndex: 10 }}>
          <p style={{ margin: 0 }}>{inputBuffer}</p>
          <small style={{ color: '#888' }}>Esperando más entrada...</small>
        </div>
      )}
    </div>
  );
};

export default VoiceAssistantUI;