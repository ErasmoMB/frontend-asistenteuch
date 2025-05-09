import React, { useState, useRef, useEffect } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { websocketService } from '../../services/websocket';
import './VoiceRecorder.css';

interface VoiceRecorderProps {
    onAudioData: (audioData: string) => void;
    isMuted: boolean;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onAudioData, isMuted }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceThreshold = -50; // dB
    const silenceDuration = 2000; // ms

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64Audio = reader.result as string;
                    onAudioData(base64Audio);
                };
            };

            mediaRecorder.start();
            setIsRecording(true);
            setError(null);
            checkSilence();
        } catch (err) {
            setError('Error al acceder al micrófono');
            console.error('Error al iniciar la grabación:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
            }
            setIsRecording(false);
        }
    };

    const checkSilence = () => {
        if (!isRecording || !analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const db = 20 * Math.log10(average / 255);

        if (db < silenceThreshold) {
            if (!silenceTimeoutRef.current) {
                silenceTimeoutRef.current = setTimeout(() => {
                    stopRecording();
                    startRecording();
                }, silenceDuration);
            }
        } else {
            if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = null;
            }
        }

        requestAnimationFrame(checkSilence);
    };

    useEffect(() => {
        if (isMuted && isRecording) {
            stopRecording();
        }
    }, [isMuted]);

    return (
        <Box>
            {error && (
                <Text color="red.500" fontSize="sm" mb="2">
                    {error}
                </Text>
            )}
            <div className={`recording-status ${isMuted ? 'muted' : ''}`}>
                {isMuted ? 'Micrófono silenciado' : 'Escuchando...'}
            </div>
        </Box>
    );
};

export default VoiceRecorder; 