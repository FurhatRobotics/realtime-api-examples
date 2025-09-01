
class CircularBuffer {
    constructor(size) {
        this.buffer = new Float32Array(size);
        this.writeIndex = 0;
        this.readIndex = 0;
        this.size = size;
        this.count = 0; // Number of elements in the buffer
    }

    write(data) {
        data.forEach((value) => {
            this.buffer[this.writeIndex] = value;
            this.writeIndex = (this.writeIndex + 1) % this.size;
            if (this.count < this.size) {
                this.count++;
            } else {
                // Overwriting old data
                this.readIndex = (this.readIndex + 1) % this.size;
            }
        });
    }

    read(length) {
        const output = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            if (this.count > 0) {
                output[i] = this.buffer[this.readIndex];
                this.readIndex = (this.readIndex + 1) % this.size;
                this.count--;
            } else {
                // Fill with silence if no data
                output[i] = 0;
            }
        }
        return output;
    }
}

class ReceiveAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.audioBuffer = new CircularBuffer(8192);
        this.port.onmessage = (event) => {
            this.audioBuffer.write(event.data);
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0]; // Assuming mono audio

        const audioData = this.audioBuffer.read(channel.length);

        for (let i = 0; i < channel.length; i++) {
            channel[i] = audioData[i] || 0; 
        }
        // Continue processing
        return true;
    }
}

registerProcessor("ReceiveAudioProcessor", ReceiveAudioProcessor);

export default ReceiveAudioProcessor;