import React, { useEffect, useRef } from 'react';

interface VoicePlayerProps {
    audioUrl: string;
}

const VoicePlayer: React.FC<VoicePlayerProps> = ({ audioUrl }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current && audioUrl) {
            audioRef.current.play().catch(error => {
                console.error('Error al reproducir audio:', error);
            });
        }
    }, [audioUrl]);

    return (
        <div className="voice-player">
            <audio ref={audioRef} src={audioUrl} />
        </div>
    );
};

export default VoicePlayer; 