class WebSocketService {
    private ws: WebSocket | null = null;
    private messageHandlers: ((data: any) => void)[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimeout = 3000;

    connect() {
        try {
            this.ws = new WebSocket('ws://localhost:8000/ws/chat');
            
            this.ws.onopen = () => {
                console.log('Conexión WebSocket establecida');
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.messageHandlers.forEach(handler => handler(data));
                } catch (error) {
                    console.error('Error al procesar mensaje:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('Conexión WebSocket cerrada');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('Error en WebSocket:', error);
            };
        } catch (error) {
            console.error('Error al conectar WebSocket:', error);
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Intentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), this.reconnectTimeout);
        } else {
            console.error('Número máximo de intentos de reconexión alcanzado');
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    sendMessage(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket no está conectado');
        }
    }

    onMessage(handler: (data: any) => void) {
        this.messageHandlers.push(handler);
        return () => {
            this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
        };
    }
}

export const websocketService = new WebSocketService(); 