const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
const appState = {
  isOn: false,
  mode: 'torch',
  intensity: 85,
  theme: 'dark',
  installPrompt: null,
  stream: null,
  strobeInterval: null,
  sosInterval: null,
  flashAvailable: false,
  flashEnabled: false,
  ambientSensor: null,
  proximitySensor: null,
};

const els = {
  body: document.body,
  powerBtn: document.getElementById('powerBtn'),
  statusText: document.getElementById('statusText'),
  deviceStatus: document.getElementById('deviceStatus'),
  installBtn: document.getElementById('installBtn'),
  intensityRange: document.getElementById('intensityRange'),
  brightnessValue: document.getElementById('brightnessValue'),
  themeToggle: document.getElementById('themeToggle'),
  vibrateBtn: document.getElementById('vibrateBtn'),
  soundBtn: document.getElementById('soundBtn'),
  modeButtons: [...document.querySelectorAll('.mode-btn')],
};

function updateStatusText() {
  if (!appState.isOn) {
    els.statusText.textContent = 'Desligada';
    return;
  }

  if (appState.mode === 'sos') {
    els.statusText.textContent = 'Modo SOS';
    return;
  }

  if (appState.mode === 'strobe') {
    els.statusText.textContent = 'Strobe';
    return;
  }

  els.statusText.textContent = 'Ligada';
}

function updateDeviceStatus() {
  if (appState.flashAvailable && appState.flashEnabled) {
    els.deviceStatus.textContent = 'Flash: disponível';
    return;
  }

  if (!isSecureContext) {
    els.deviceStatus.textContent = 'Flash: precisa de HTTPS/localhost';
    return;
  }

  els.deviceStatus.textContent = 'Flash: sem suporte do navegador';
}

function updateIntensityLabel() {
  els.brightnessValue.textContent = `${appState.intensity}%`;
  els.body.style.setProperty('--torch-strength', (appState.intensity / 100).toFixed(2));
}

function updateThemeButton() {
  const label = appState.theme === 'dark' ? 'Tema escuro' : 'Tema claro';
  els.themeToggle.textContent = label;
}

function setTheme(nextTheme) {
  appState.theme = nextTheme;
  els.body.classList.toggle('light-mode', nextTheme === 'light');
  updateThemeButton();
}

function vibrateAction(pattern = 80) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

function playTone(frequency = 880, duration = 120) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  const ctx = new AudioCtx();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.0001;

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
  oscillator.start(now);
  oscillator.stop(now + duration / 1000 + 0.04);
}

function beepPattern(pattern = [880, 220, 880]) {
  pattern.forEach((freq, index) => {
    setTimeout(() => playTone(freq, index === 0 ? 120 : 90), index * 150);
  });
}

function stopModes() {
  if (appState.strobeInterval) {
    clearInterval(appState.strobeInterval);
    appState.strobeInterval = null;
  }

  if (appState.sosInterval) {
    clearInterval(appState.sosInterval);
    appState.sosInterval = null;
  }

  els.body.classList.remove('torch-on');
}

async function stopCameraFlash() {
  if (!appState.stream) {
    return;
  }

  appState.stream.getTracks().forEach((track) => track.stop());
  appState.stream = null;
  appState.flashEnabled = false;
}

async function ensureCameraTorch() {
  if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
    return false;
  }

  try {
    appState.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    const track = appState.stream.getVideoTracks()[0];
    if (!track) {
      return false;
    }

    const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
    appState.flashAvailable = !!capabilities.torch;

    if (capabilities.torch) {
      await track.applyConstraints({
        advanced: [{ torch: true }],
      });
      appState.flashEnabled = true;
      appState.flashAvailable = true;
      return true;
    }

    appState.flashAvailable = false;
    appState.flashEnabled = false;
    return false;
  } catch (error) {
    console.warn('Falha ao ativar flash da câmera:', error);
    appState.flashAvailable = false;
    appState.flashEnabled = false;
    return false;
  }
}

function setPowerState(nextState) {
  appState.isOn = nextState;
  els.body.classList.toggle('torch-on', nextState);
  updateStatusText();
  updateDeviceStatus();
  if (!nextState) {
    stopModes();
    stopCameraFlash();
  }
}

async function toggleTorch() {
  if (appState.mode === 'sos') {
    if (appState.isOn) {
      stopModes();
      await stopCameraFlash();
      setPowerState(false);
      return;
    }

    setPowerState(true);
    startSOS();
    return;
  }

  if (appState.mode === 'strobe') {
    if (appState.isOn) {
      stopModes();
      await stopCameraFlash();
      setPowerState(false);
      return;
    }

    setPowerState(true);
    startStrobe();
    return;
  }

  if (!appState.isOn) {
    setPowerState(true);
    if (await ensureCameraTorch()) {
      updateDeviceStatus();
      vibrateAction(80);
      beepPattern([750, 900]);
      return;
    }

    vibrateAction(80);
    beepPattern([520, 620]);
    return;
  }

  stopModes();
  await stopCameraFlash();
  setPowerState(false);
}

function startStrobe() {
  if (appState.strobeInterval) {
    return;
  }

  let visible = true;
  appState.strobeInterval = setInterval(() => {
    visible = !visible;
    els.body.classList.toggle('torch-on', visible);
    const active = visible ? true : false;
    if (active) {
      vibrateAction(30);
      playTone(1200, 50);
    }
  }, 120);
}

function startSOS() {
  if (appState.sosInterval) {
    return;
  }

  const sosPattern = [
    0.3, 0.3, 0.3,
    0.7, 0.7, 0.7,
    0.3, 0.3, 0.3,
    1.2,
  ];

  let index = 0;
  const pulse = () => {
    const active = index % 2 === 0;
    els.body.classList.toggle('torch-on', active);
    if (active) {
      vibrateAction(35);
      playTone(880, 80);
    }

    index += 1;
  };

  pulse();
  appState.sosInterval = setInterval(() => {
    pulse();
  }, 220);

  setTimeout(() => {
    clearInterval(appState.sosInterval);
    appState.sosInterval = null;
    stopModes();
    setPowerState(false);
  }, 7000);
}

function bindModeButtons() {
  els.modeButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const nextMode = button.dataset.mode;
      appState.mode = nextMode;
      els.modeButtons.forEach((btn) => btn.classList.toggle('active', btn === button));

      if (appState.isOn) {
        stopModes();
        await stopCameraFlash();
        setPowerState(false);
      }

      updateStatusText();
      updateDeviceStatus();
    });
  });
}

function bindControls() {
  els.powerBtn.addEventListener('click', async () => {
    await toggleTorch();
    updateStatusText();
  });

  els.intensityRange.addEventListener('input', (event) => {
    appState.intensity = Number(event.target.value);
    updateIntensityLabel();
    if (appState.isOn) {
      els.body.style.setProperty('--torch-strength', (appState.intensity / 100).toFixed(2));
    }
  });

  els.themeToggle.addEventListener('click', () => {
    setTheme(appState.theme === 'dark' ? 'light' : 'dark');
  });

  els.vibrateBtn.addEventListener('click', () => {
    vibrateAction([60, 30, 60]);
  });

  els.soundBtn.addEventListener('click', () => {
    beepPattern([440, 660, 880]);
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    appState.installPrompt = event;
    els.installBtn.classList.remove('hidden');
  });

  els.installBtn.addEventListener('click', async () => {
    if (!appState.installPrompt) {
      return;
    }

    appState.installPrompt.prompt();
    await appState.installPrompt.userChoice;
    appState.installPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function setupSensors() {
  const AmbientLightSensor = window.AmbientLightSensor;
  const ProximitySensor = window.ProximitySensor;

  if ('AmbientLightSensor' in window) {
    try {
      appState.ambientSensor = new AmbientLightSensor({ frequency: 1 });
      appState.ambientSensor.addEventListener('reading', () => {
        if (appState.ambientSensor.illuminance < 40 && !appState.isOn) {
          setTheme('dark');
        }
      });
      appState.ambientSensor.start();
    } catch (error) {
      console.info('Sensor de luz ambiente não disponível:', error);
    }
  }

  if ('ProximitySensor' in window) {
    try {
      appState.proximitySensor = new ProximitySensor({ frequency: 1 });
      appState.proximitySensor.addEventListener('reading', () => {
        if (appState.proximitySensor.distance < 5 && appState.isOn) {
          stopModes();
          setPowerState(false);
        }
      });
      appState.proximitySensor.start();
    } catch (error) {
      console.info('Sensor de proximidade não disponível:', error);
    }
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.register('./sw.js').catch((error) => {
    console.warn('Service Worker falhou:', error);
  });
}

function initialize() {
  if (!isSecureContext) {
    console.warn('O PWA precisa de HTTPS ou localhost para usar flash, instalação e cache offline.');
  }

  bindControls();
  bindModeButtons();
  updateIntensityLabel();
  updateStatusText();
  updateThemeButton();
  updateDeviceStatus();
  registerServiceWorker();
  setupSensors();
}

initialize();
