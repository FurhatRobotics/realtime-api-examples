import { CONFIG } from './config.js';

window.addEventListener('load', async () => {

    // Connect button logic
    const connectButton = document.getElementById('connectButton');
    let isConnected = false;

    // Set up connection state handlers
    CONFIG.eventBus.on('connection.success', () => {
        isConnected = true;
        connectButton.disabled = false;
        connectButton.innerText = "Disconnect";
        waitForConnection();
    });

    CONFIG.eventBus.on('connection.error', () => {
        isConnected = false;
        connectButton.disabled = false;
        connectButton.innerText = "Connect";
    });

    CONFIG.eventBus.on('connection.closed', (data) => {
        isConnected = false;
        connectButton.disabled = false;
        connectButton.innerText = "Connect";
        // Cleanup managers when disconnected
        if (CONFIG.sendAudioManager.cleanup) CONFIG.sendAudioManager.cleanup();
        if (CONFIG.receiveAudioManager.cleanup) CONFIG.receiveAudioManager.cleanup();
        if (CONFIG.mediaPipeManager.disableTracking) CONFIG.mediaPipeManager.disableTracking();
        // Reset checkboxes
        webcamCheckbox.checked = false;
        sendAudioCheckbox.checked = false;
        receiveAudioCheckbox.checked = false;
        attendClosestCheckbox.checked = false;
    });

    connectButton.addEventListener('click', () => {
        if (!isConnected) {
            // Connecting
            CONFIG.eventBus.connect();
            connectButton.disabled = true;
            connectButton.innerText = "Connecting...";
        } else {
            // Disconnecting
            CONFIG.eventBus.disconnect();
            connectButton.disabled = true;
            connectButton.innerText = "Disconnecting...";
        }
    });

    // Checkbox logic
    const webcamCheckbox = document.getElementById('webcamCheckbox');
    const sendAudioCheckbox = document.getElementById('sendAudioCheckbox');
    const receiveAudioCheckbox = document.getElementById('receiveAudioCheckbox');
    const attendClosestCheckbox = document.getElementById('attendClosestCheckbox');

    // Store reference to checkbox in CONFIG for access from other modules
    CONFIG.attendClosestCheckbox = attendClosestCheckbox;

    if (webcamCheckbox) {
        webcamCheckbox.addEventListener('change', () => {
            if (webcamCheckbox.checked) {
                CONFIG.mediaPipeManager.enableTracking();
            } else {
                CONFIG.mediaPipeManager.disableTracking();
            }
        });
    }
    if (sendAudioCheckbox) {
        sendAudioCheckbox.addEventListener('change', () => {
            CONFIG.sendAudioManager.toggleSendAudio(sendAudioCheckbox.checked);
        });
    }
    if (receiveAudioCheckbox) {
        receiveAudioCheckbox.addEventListener('change', () => {
            CONFIG.receiveAudioManager.toggleReceiveAudio(receiveAudioCheckbox.checked);
        });
    }

    if (attendClosestCheckbox) {
        attendClosestCheckbox.addEventListener('change', () => {
            CONFIG.robotCameraManager.setAttendClosest(attendClosestCheckbox.checked);
        });
    }

    function waitForConnection() {
        if (CONFIG.eventBus.isConnected()) {
            CONFIG.robotCameraManager.init();
            CONFIG.sendAudioManager.init();
            CONFIG.receiveAudioManager.init();
            CONFIG.mediaPipeManager.init();
        } else {
            setTimeout(waitForConnection, 200); 
        }
    }
});