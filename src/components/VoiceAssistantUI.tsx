import React from 'react';
import './VoiceAssistantUI.css';
import { FaInfoCircle, FaVolumeUp, FaVolumeMute, FaSlidersH, FaMicrophone, FaMicrophoneSlash, FaTimes } from 'react-icons/fa';
import assistantImg from '../assets/assistant.png';

interface VoiceAssistantUIProps {
  onClose: () => void;
  micActive: boolean;
  onMicToggle: () => void;
}

const VoiceAssistantUI: React.FC<VoiceAssistantUIProps> = ({ onClose, micActive, onMicToggle }) => {
  const [voiceActive, setVoiceActive] = React.useState(true);

  return (
    <div className="va-container">
      {/* Iconos arriba derecha */}
      <div className="va-top-icons">
        <FaInfoCircle className="va-icon" title="Información" />
        {voiceActive ? (
          <FaVolumeUp className="va-icon va-icon-btn" title="Silenciar voz" onClick={() => setVoiceActive(false)} />
        ) : (
          <FaVolumeMute className="va-icon va-icon-btn" title="Activar voz" onClick={() => setVoiceActive(true)} />
        )}
        <FaSlidersH className="va-icon" title="Configuración" />
      </div>

      {/* Imagen central */}
      <div className="va-center-circle">
        <img src={assistantImg} alt="Asistente" className="va-assistant-img" />
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
    </div>
  );
};

export default VoiceAssistantUI; 