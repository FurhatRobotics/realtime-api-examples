import { CONFIG, getWebSocketUrl, getAuthKey } from '../config.js';

export class EventBus {
    constructor() {
        this.socket = null;
        this.handlers = new Map();
        this.lastEventTime = new Map();
        this.on('response.auth', (data) => {
            console.log('Authentication response:', data);
            if (data.access) {
                this.send("request.users.start");
                this.send("request.camera.start");
            }
        });
    }

    connect() {
        this.socket = new WebSocket(getWebSocketUrl(CONFIG.wsapi.events, CONFIG.wsapi.port));
        
        this.socket.onopen = () => {
            console.log('EventBus WebSocket connected');
            this.send("request.auth", {key: getAuthKey()});
            // Emit connection success event
            this.emit('connection.success');
        };

        this.socket.onclose = (event) => {
            console.log('EventBus WebSocket closed');
            // Emit connection closed event
            this.emit('connection.closed', { wasClean: event.wasClean, code: event.code });
        }

        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            //console.log(message);
            if (this.handlers.has(message.type)) {
                this.handlers.get(message.type).forEach(handler => handler(message));
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            // Emit connection error event
            this.emit('connection.error', error);
        };
    }

    isConnected() {
        return this.socket && this.socket.readyState === WebSocket.OPEN;
    }

    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event).add(handler);
    }

    off(event, handler) {
        if (this.handlers.has(event)) {
            this.handlers.get(event).delete(handler);
        }
    }

    emit(event, data = {}) {
        if (this.handlers.has(event)) {
            this.handlers.get(event).forEach(handler => handler(data));
        }
    }

    send(event, data = {}) {
        if (this.isConnected()) {
            const now = Date.now();
            if (this.lastEventTime.has(event) && event in CONFIG.eventThrottlers) {
                if (now - this.lastEventTime.get(event) < CONFIG.eventThrottlers[event]) {
                    return;
                }
            }
            this.lastEventTime.set(event, now);
            this.socket.send(JSON.stringify({ type: event, ...data }));
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}
