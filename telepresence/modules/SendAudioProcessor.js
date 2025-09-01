class EnergyVAD {
    constructor(threshold = 0.02, bufferSize = 160, cooldownTime = 500) {
        this.threshold = threshold;
        this.bufferSize = bufferSize;
        this.audioBuffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
        this.speaking = false;
        this.lastSpeechTime = 0;
        this.cooldownTime = cooldownTime; // 500ms cooldown
        this.lastRms = 0;
    }

    append(value) {
        this.audioBuffer[this.bufferIndex++] = value;
        if (this.bufferIndex >= this.bufferSize) {
            this.bufferIndex = 0;
            let sum = 0;
            for (let i = 0; i < this.audioBuffer.length; i++) {
                sum += Math.pow(this.audioBuffer[i], 2);
            }
            const rms = Math.sqrt(sum / this.audioBuffer.length);
            this.lastRms = rms;
            const isSpeaking = rms > this.threshold;
            const nowTime = Date.now();

            if (isSpeaking) {
                this.speaking = true;
                this.lastSpeechTime = nowTime;
            } else if (this.speaking && nowTime - this.lastSpeechTime > this.cooldownTime) {
                this.speaking = false;
            }
        }
    }
}

class SendAudioProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.vad = new EnergyVAD();
        this.isSpeaking = false;
        this.lastRmsSent = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        
        if (input && input[0]) {
            const channelData = input[0];

            let isSpeakingInFrame = false;
            const buffer = new ArrayBuffer(channelData.length * 2);
            const view = new DataView(buffer);

            for (let i = 0; i < channelData.length; i++) {
                const value = Math.max(-1, Math.min(1, channelData[i]));
                const int16 = value < 0 ? value * 0x8000 : value * 0x7FFF;
                view.setInt16(i * 2, int16, true); 
                this.vad.append(value);
            }

            if (this.vad.speaking != this.isSpeaking || Math.abs(this.vad.lastRms - this.lastRmsSent) > 0.001) {
                this.isSpeaking = this.vad.speaking;
                this.lastRmsSent = this.vad.lastRms;
                this.port.postMessage({ speaking: this.isSpeaking });
            }

            this.port.postMessage({ rms: this.vad.lastRms });
            this.port.postMessage(buffer);
        }

        return true;
    }
}

registerProcessor('SendAudioProcessor', SendAudioProcessor);

export default SendAudioProcessor;