import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
import { CONFIG } from '../config.js';

const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

export class MediaPipeManager {
    constructor() {
        this.faceLandmarker = null;
        this.runningMode = "IMAGE";
        this.webcamRunning = false;
        this.drawingUtils = null;
        this.lastVideoTime = -1;
        this.results = undefined;
        this.sendingAnimations = false;
    }

    async init() {
        const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
            runningMode: this.runningMode,
            numFaces: 1
        });

        this.drawingUtils = new DrawingUtils(document.getElementById("webcam_overlay").getContext("2d"));
        this.sendHeadpose(0, 0, 0); 
    }

    enableTracking() {
        if (!this.faceLandmarker) {
            console.log("Wait! faceLandmarker not loaded yet.");
            return;
        }
        if (this.webcamRunning) return;
        this.webcamRunning = true;
        this.sendingAnimations = true;
        this.startWebcam();
    }

    disableTracking() {
        if (!this.webcamRunning) return;
        this.webcamRunning = false;
        this.sendingAnimations = false;
        CONFIG.state.userHeadposeHist.reset(0, 0, 0);
        this.sendHeadpose(0, 0, 0);
    }

    startWebcam() {
        const constraints = { video: true };
        const webcamVideo = document.getElementById("webcam");

        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            webcamVideo.srcObject = stream;
            webcamVideo.addEventListener("loadeddata", () => this.predictWebcam());
        });
    }

    async predictWebcam() {
        const webcamVideo = document.getElementById("webcam");
        const webcamOverlay = document.getElementById("webcam_overlay");
        const radio = webcamVideo.videoHeight / webcamVideo.videoWidth;
        const videoWidth = 304;

        webcamVideo.style.width = videoWidth + "px";
        webcamVideo.style.height = videoWidth * radio + "px";
        webcamOverlay.style.width = videoWidth + "px";
        webcamOverlay.style.height = videoWidth * radio + "px";
        webcamOverlay.width = webcamVideo.videoWidth;
        webcamOverlay.height = webcamVideo.videoHeight;

        if (this.runningMode === "IMAGE") {
            this.runningMode = "VIDEO";
            await this.faceLandmarker.setOptions({ runningMode: this.runningMode });
        }

        let startTimeMs = performance.now();
        if (this.lastVideoTime !== webcamVideo.currentTime) {
            this.lastVideoTime = webcamVideo.currentTime;
            this.results = this.faceLandmarker.detectForVideo(webcamVideo, startTimeMs);
        }

        if (this.results.faceLandmarks) {
            this.drawFaceLandmarks();
        }

        this.sendAnimation(this.results);

        if (this.webcamRunning === true) {
            window.requestAnimationFrame(() => this.predictWebcam());
        }
    }

    drawFaceLandmarks() {
        for (const landmarks of this.results.faceLandmarks) {
            this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                { color: "#C0C0C070", lineWidth: 1 });
            this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
                { color: "#FF3030" });
            this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
                { color: "#FF3030" });
            this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
                { color: "#30FF30" });
            this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
                { color: "#30FF30" });
            this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
                { color: "#E0E0E0" });
            this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS,
                { color: "#E0E0E0" });
            this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
                { color: "#FF3030" });
            this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
                { color: "#30FF30" });
        }
    }

    extractYawPitchRoll(transformationMatrixRecord) {
        if (!Array.isArray(transformationMatrixRecord) || transformationMatrixRecord.length !== 1) {
            throw new Error("Invalid transformation matrix record");
        }
        
        let { columns, rows, data } = transformationMatrixRecord[0];
        if (columns !== 4 || rows !== 4 || data.length !== 16) {
            throw new Error("Transformation matrix must be 4x4 with 16 elements");
        }
        
        let matrix = [];
        for (let i = 0; i < 4; i++) {
            matrix.push(data.slice(i * 4, (i + 1) * 4));
        }

        let R = [
            matrix[0].slice(0, 3),
            matrix[1].slice(0, 3),
            matrix[2].slice(0, 3)
        ];

        let sy = Math.sqrt(R[0][0] ** 2 + R[1][0] ** 2);
        let singular = sy < 1e-6;
        let yaw, pitch, roll;

        if (!singular) {
            pitch = Math.atan2(R[2][1], R[2][2]);
            yaw = Math.atan2(-R[2][0], sy);
            roll = Math.atan2(R[1][0], R[0][0]);
        } else {
            pitch = Math.atan2(-R[1][2], R[1][1]);
            yaw = Math.atan2(-R[2][0], sy);
            roll = 0;
        }

        return [ -yaw * 180 / Math.PI, -pitch * 180 / Math.PI, -roll * 180 / Math.PI ];
    }

    sendHeadpose(yaw, pitch, roll) {
        CONFIG.eventBus.send("request.face.headpose", { 
            yaw: yaw - CONFIG.state.userHeadposeHist.meanYaw(), 
            pitch: pitch - CONFIG.state.userHeadposeHist.meanPitch(), 
            roll: roll - CONFIG.state.userHeadposeHist.meanRoll(), 
            relative: true 
        });
    }

    sendAnimation(results) {
        if (!this.sendingAnimations || !CONFIG.eventBus.isConnected() || !results) {
            return;
        }

        try {
            let [yaw, pitch, roll] = this.extractYawPitchRoll(results.facialTransformationMatrixes);
            CONFIG.state.userHeadpose.yaw = yaw;
            CONFIG.state.userHeadpose.pitch = pitch;
            CONFIG.state.userHeadpose.roll = roll;
            CONFIG.state.userHeadposeHist.add(yaw, pitch, roll);
            this.sendHeadpose(yaw, pitch, roll);
        } catch (error) {
        }
        
        if (results.faceBlendshapes?.[0]?.categories) {
            const categoriesRecord = {};
            const params = {};
            
            results.faceBlendshapes[0].categories.forEach(category => {
                const formattedCategoryName = category.categoryName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
                categoriesRecord[formattedCategoryName] = category.score;
                const nameLower = category.categoryName.toLowerCase();
                if (
                    nameLower.includes("brow") ||
                    nameLower.includes("smile") ||
                    (!CONFIG.state.userSpeaking && (nameLower.includes("mouth") || nameLower.includes("jaw")))
                ) {

                    params[formattedCategoryName] = category.score * CONFIG.face.paramAmplification;
                }
            });

            if (Object.keys(params).length > 0) {
                CONFIG.eventBus.send("request.face.params", { params });
            }
        }
    }
}
