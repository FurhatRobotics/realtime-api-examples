import { CONFIG, getWebSocketUrl } from '../config.js';

export class ReceiveAudioManager {
    constructor() {
        this.receiveWorkletNode = null;
        this.receiveAudioContext = null;
        this.receivingAudio = false;
    }

    async startReceiveAudio() {
        try {
            CONFIG.eventBus.send("request.audio.start");

            this.receiveAudioContext = new AudioContext({ sampleRate: 16000 });
            await this.receiveAudioContext.audioWorklet.addModule('./modules/ReceiveAudioProcessor.js');

            this.receiveWorkletNode = new AudioWorkletNode(this.receiveAudioContext, "ReceiveAudioProcessor");
            this.receiveWorkletNode.connect(this.receiveAudioContext.destination);

            this.receivingAudio = true;
        } catch (error) {
            console.error("Error starting audio receive:", error);
            this.stopReceiveAudio();
            throw error;
        }
    }

    audioReceived(base64Data) {
        if (this.receiveWorkletNode && base64Data) {
            let data = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const pcmData = new Int16Array(data.buffer);
            const floatData = Float32Array.from(pcmData, val => val / 32768);
            if (!CONFIG.state.userSpeaking) {
                this.receiveWorkletNode.port.postMessage(floatData);
            }
        }
    }

    stopReceiveAudio() {
        CONFIG.eventBus.send("request.microphone.stop");
        if (this.receiveWorkletNode) {
            this.receiveWorkletNode.disconnect();
            this.receiveWorkletNode = null;
        }
        if (this.receiveAudioContext) {
            this.receiveAudioContext.close();
            this.receiveAudioContext = null;
        }
        this.receivingAudio = false;
        //eventBus.emit('audioReceiveStopped');
    }

    toggleReceiveAudio(enable) {
        if (enable) {
            this.startReceiveAudio();
        } else {
            this.stopReceiveAudio();
        }
    }

    cleanup() {
        this.stopReceiveAudio();
    }

    init() {
        CONFIG.eventBus.on('response.audio.data', (event) => this.audioReceived(event.microphone));
    }
}

