import { EventBus } from './modules/EventBus.js';
import { MediaPipeManager } from './modules/MediaPipe.js';
import { RobotCameraManager } from './modules/RobotCamera.js';
import { SendAudioManager } from './modules/SendAudioManager.js';
import { ReceiveAudioManager } from './modules/ReceiveAudioManager.js';


export const CONFIG = {
    wsapi: {
        port: 9000,
        events: "/v1/events",
        sendAudio: "/v1/audio/send",
        camera: "/v1/camera"
    },
    audio: {
        sampleRate: 16000,
        vadThreshold: 0.02,
        bufferSize: 160
    },
    ux: {
        controlWidth: 340
    },
    eventThrottlers: {
        "request.face.headpose": 100,
        "request.face.params": 20
    },
    face: {
        paramAmplification: 1.0
    },
    state: {
        userSpeaking: false,
        userHeadpose: {yaw: 0, pitch: 0, roll: 0},
        vadEnergy: 0
    },
    eventBus: new EventBus(),
    sendAudioManager: new SendAudioManager(),
    receiveAudioManager: new ReceiveAudioManager(),
    mediaPipeManager: new MediaPipeManager(),
    robotCameraManager: new RobotCameraManager()
};

export function getWebSocketUrl(path, port) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = document.getElementById('ipInput').value;
    return `${protocol}://${host}:${port}${path}`;
}

export function getAuthKey() {
    return document.getElementById('authKeyInput').value;
}
