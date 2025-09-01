import { CONFIG, getWebSocketUrl } from '../config.js';

export class SendAudioManager {
    constructor() {
        this.sendWorkletNode = null;
        this.sendAudioContext = null;
        this.mediaStream = null;
        this.sendingAudio = false;
        this.sendAudioCheckbox = document.getElementById("sendAudioCheckbox");
        this.audioBuffer = [];
        this.sendingAudioData = false;
    }

    async startSendAudio() {

        this.sendAudioContext = new AudioContext({ sampleRate: 16000 });
        await this.sendAudioContext.audioWorklet.addModule('./modules/SendAudioProcessor.js');

        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = this.sendAudioContext.createMediaStreamSource(this.mediaStream);
        this.sendWorkletNode = new AudioWorkletNode(this.sendAudioContext, 'SendAudioProcessor');

        this.setupSendWorkletHandlers();
        source.connect(this.sendWorkletNode);
        this.sendWorkletNode.connect(this.sendAudioContext.destination);
        this.sendingAudio = true;
        this.sendingAudioData = false;
        CONFIG.state.userSpeaking = false;
    }

    setupSendWorkletHandlers() {
        this.sendWorkletNode.port.onmessage = (event) => {
            if (event.data.speaking !== undefined) {
                const oldSpeakingState = CONFIG.state.userSpeaking;
                CONFIG.state.userSpeaking = event.data.speaking;
                if (!oldSpeakingState && CONFIG.state.userSpeaking) {
                    this.startingSendingAudioData();
                    this.audioBuffer.forEach(buffer => this.sendAudioData(buffer));
                    this.audioBuffer = [];
                } else if (oldSpeakingState && !CONFIG.state.userSpeaking) {
                    this.stopSendingAudioData();
                }
            } else if (event.data.rms !== undefined) {
                CONFIG.state.vadEnergy = event.data.rms;
                this.updateVadIndicator();
            } else if (event.data instanceof ArrayBuffer) {
                if (CONFIG.state.userSpeaking) { 
                    this.sendAudioData(event.data);
                } else {
                    this.audioBuffer.push(event.data);
                    if (this.audioBuffer.length > 10) {
                        this.audioBuffer.shift();
                    }
                }
            }
        };
    }

    updateVadIndicator() {
        const vadIndicator = document.getElementById("vadLevelIndicator");
        if (vadIndicator) {
            const speaking = CONFIG.state.userSpeaking;
            const visualEnergy = CONFIG.state.vadEnergy; 
            vadIndicator.style.backgroundColor = speaking ? 'green' : 'lightgray';
            vadIndicator.style.width = `${Math.min(304, 15 + visualEnergy * 600)}px`;
        }
    }

    sendAudioData(data) {
        if (this.sendingAudioData) {
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(data)));
            CONFIG.eventBus.send("request.speak.audio.data", {audio: base64Audio});
        }
    }

    startingSendingAudioData() {
        CONFIG.eventBus.send("request.speak.audio.start");
        this.sendingAudioData = true;
    }
    
    stopSendingAudioData() {
        CONFIG.eventBus.send("request.speak.audio.end");
        this.sendingAudioData = false;
    }

    stopSendAudio() {
        CONFIG.eventBus.send("request.speak.stop");
        if (this.sendWorkletNode) {
            this.sendWorkletNode.disconnect();
            this.sendWorkletNode = null;
        }
        if (this.sendAudioContext) {
            this.sendAudioContext.close();
            this.sendAudioContext = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        this.sendingAudio = false;
        this.sendingAudioData = false;
        CONFIG.state.userSpeaking = false;
        CONFIG.state.vadEnergy = 0;
        this.updateVadIndicator();
    }

    toggleSendAudio(enable) {
        if (enable) {
            this.startSendAudio();
        } else {
            this.stopSendAudio();
        }
    }

    cleanup() {
        this.stopSendAudio();
    }

    init() {
        // No longer needed, handled in main.js
    }
}

