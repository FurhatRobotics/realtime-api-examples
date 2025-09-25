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

    // Canvas Sizing
    function fitCanvasTo(el, canvas){
      const r = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
    }
  
    // Connect Modal (open/close logic)
    const connectModal = document.getElementById('connectModal');
    const ipEl = document.getElementById('ipInput');
  
    function openConnectModal() {
      connectModal.hidden = false;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => ipEl && ipEl.focus());
    }
    function closeConnectModal() {
      connectModal.hidden = true;
      document.body.style.overflow = '';
    }
    connectModal.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-close')) closeConnectModal();
    });
    window.addEventListener('keydown', (e) => {
      if (!connectModal.hidden && e.key === 'Escape') closeConnectModal();
    });
    openConnectModal();                    // show on first load
    window.closeConnectModal = closeConnectModal;
    document.getElementById('btnSettings')?.addEventListener('click', openConnectModal);

    // Confirm Disconnect Modal (open/close logic)
    const confirmModal = document.getElementById('confirmModal');
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmDisconnect = document.getElementById('confirmDisconnect');

    function openConfirmModal() {
      confirmModal.hidden = false;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => confirmDisconnect?.focus());
    }
    function closeConfirmModal() {
      confirmModal.hidden = true;
      document.body.style.overflow = '';
    }
    confirmModal.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-close')) closeConfirmModal();
    });
    window.addEventListener('keydown', (e) => {
      if (!confirmModal.hidden && e.key === 'Escape') closeConfirmModal();
    });

    confirmCancel?.addEventListener('click', closeConfirmModal);
    confirmDisconnect?.addEventListener('click', () => {
      const connectBtn = document.getElementById('connectButton');
      if (connectBtn && /disconnect/i.test((connectBtn.textContent || connectBtn.value || '').trim())) {
        connectBtn.click();
      }
      closeConfirmModal();
    });

    // UI Element References
    const el = {
      robot: document.getElementById('robotcam'),
      robotOverlay: document.getElementById('robotcam_overlay'),
      webcam: document.getElementById('webcam'),
      webcamOverlay: document.getElementById('webcam_overlay'),
  
      btnMic: document.getElementById('btnMic'),
      btnFace: document.getElementById('btnFace'),
      btnAttend: document.getElementById('btnAttend'),
      btnSpeaker: document.getElementById('btnSpeaker'),
      btnSettings: document.getElementById('btnSettings'),
      btnHangup: document.getElementById('btnHangup'),
  
      toggles: {
        face: document.getElementById('webcamCheckbox'),
        sendAudio: document.getElementById('sendAudioCheckbox'),
        recvAudio: document.getElementById('receiveAudioCheckbox'),
        attend: document.getElementById('attendClosestCheckbox'),
      }
    };

    // Disconnect Button Handler
    function performDisconnect() {
      const connectBtn = document.getElementById('connectButton');
      if (!connectBtn) return;
      const txt = (connectBtn.textContent || connectBtn.value || '').trim().toLowerCase();

      if (txt.includes('disconnect')) {
        openConfirmModal();
      } else {
        openConnectModal();
      }
    }
    el.btnHangup?.addEventListener('click', performDisconnect);

    // Responsive Canvas Resizing
    const sizeAll = () => {
      if (el.robot && el.robotOverlay) fitCanvasTo(el.robot, el.robotOverlay);
      if (el.webcam && el.webcamOverlay) fitCanvasTo(el.webcam, el.webcamOverlay);
    };
    window.addEventListener('load', sizeAll);
    window.addEventListener('resize', sizeAll);
  
    // Button ↔ Checkbox Sync Logic
    function wireButtonToCheckbox(btn, checkbox) {
      if (!btn || !checkbox) return;
      const setPressed = (on) => {
        btn.setAttribute('aria-pressed', String(on));
        btn.classList.toggle('is-off', !on);
      };
      setPressed(checkbox.checked);
      btn.addEventListener('click', () => {
        checkbox.checked = !checkbox.checked;
        setPressed(checkbox.checked);
        checkbox.dispatchEvent(new Event('input', { bubbles: true }));
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      });
      checkbox.addEventListener('change', () => setPressed(checkbox.checked));
    }
    wireButtonToCheckbox(el.btnMic,     el.toggles.sendAudio);
    wireButtonToCheckbox(el.btnFace,    el.toggles.face);
    wireButtonToCheckbox(el.btnAttend,  el.toggles.attend);
    wireButtonToCheckbox(el.btnSpeaker, el.toggles.recvAudio);

});