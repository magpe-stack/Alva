const appState = {
  isOn: false,
  mode: 'torch',
  intensity: 85,
  installPrompt: null,
  vibrationEnabled: false,
  soundEnabled: false,
  audioContext: null,
  strobeInterval: null,
  sosInterval: null,
};

const els = {
  body: document.body,
  powerBtn: document.getElementById('powerBtn'),
  statusText: document.getElementById('statusText'),
  deviceStatus: document.getElementById('deviceStatus'),
  installBtn: document.getElementById('installBtn'),
  intensityRange: document.getElementById('intensityRange'),
  brightnessValue: document.getElementById('brightnessValue'),
  vibrateBtn: document.getElementById('vibrateBtn'),
  soundBtn: document.getElementById('soundBtn'),
  modeButtons: [...document.querySelectorAll('.mode-btn')],
};

function updateStatusText() {
  if (!appState.isOn) {
    els.statusText.textContent = 'Desligada';
  } else if (appState.mode === 'sos') {
    els.statusText.textContent = 'Modo SOS';
  } else if (appState.mode === 'strobe') {
    els.statusText.textContent = 'Strobe';
  } else {
    els.statusText.textContent = 'Ligada';
  }
}

function updateIntensityLabel() {
  els.brightnessValue.textContent = `${appState.intensity}%`;
  // Controla a luz desenhada na tela. A Web não consegue definir o brilho
  // físico do painel do celular de forma compatível entre navegadores.
  els.body.style.setProperty('--torch-strength', (appState.intensity / 100).toFixed(2));
}

function vibrateAction(pattern = 120) {
  if (!appState.vibrationEnabled || typeof navigator.vibrate !== 'function') return false;
  return navigator.vibrate(pattern);
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!appState.audioContext || appState.audioContext.state === 'closed') {
    appState.audioContext = new AudioContextClass();
  }
  return appState.audioContext;
}

async function playTone(frequency = 660, duration = 180) {
  const context = getAudioContext();
  if (!context) return false;

  try {
    if (context.state === 'suspended') await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration / 1000);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration / 1000 + 0.03);
    return true;
  } catch (error) {
    console.warn('Não foi possível reproduzir o som:', error);
    return false;
  }
}

function playPattern(frequencies) {
  frequencies.forEach((frequency, index) => {
    window.setTimeout(() => {
      if (appState.soundEnabled) playTone(frequency, 170);
    }, index * 220);
  });
}

function stopModes() {
  if (appState.strobeInterval) window.clearInterval(appState.strobeInterval);
  if (appState.sosInterval) window.clearInterval(appState.sosInterval);
  appState.strobeInterval = null;
  appState.sosInterval = null;
  els.body.classList.remove('torch-on', 'strobe-off');
}

function setPowerState(nextState) {
  appState.isOn = nextState;
  els.body.classList.toggle('torch-on', nextState);
  updateStatusText();
  if (!nextState) stopModes();
}

function startStrobe() {
  if (appState.strobeInterval) return;
  let visible = true;
  appState.strobeInterval = window.setInterval(() => {
    visible = !visible;
    els.body.classList.toggle('strobe-off', !visible);
    if (visible) {
      vibrateAction(40);
      if (appState.soundEnabled) playTone(780, 70);
    }
  }, 500);
}

function startSOS() {
  if (appState.sosInterval) return;
  // SOS visual em pulsos lentos, sem alegar que é um sinal de emergência certificado.
  const sequence = [true, false, true, false, true, false, false, true, false, true, false, true, false, false, true, false, true, false, true, false, false];
  let index = 0;
  appState.sosInterval = window.setInterval(() => {
    const visible = sequence[index % sequence.length];
    els.body.classList.toggle('strobe-off', !visible);
    if (visible) {
      vibrateAction(35);
      if (appState.soundEnabled) playTone(660, 100);
    }
    index += 1;
  }, 350);
}

async function toggleTorch() {
  if (appState.isOn) {
    setPowerState(false);
    return;
  }

  setPowerState(true);
  vibrateAction(80);
  if (appState.mode === 'sos') startSOS();
  if (appState.mode === 'strobe') startStrobe();
}

function bindControls() {
  els.powerBtn.addEventListener('click', toggleTorch);

  els.intensityRange.addEventListener('input', (event) => {
    appState.intensity = Number(event.target.value);
    updateIntensityLabel();
  });

  els.vibrateBtn.addEventListener('click', () => {
    if (typeof navigator.vibrate !== 'function') {
      els.vibrateBtn.textContent = 'Vibração indisponível';
      return;
    }
    appState.vibrationEnabled = !appState.vibrationEnabled;
    els.vibrateBtn.setAttribute('aria-pressed', String(appState.vibrationEnabled));
    els.vibrateBtn.textContent = appState.vibrationEnabled ? 'Vibração: ligada' : 'Vibração: desligada';
    if (appState.vibrationEnabled) navigator.vibrate([120, 60, 120]);
    else navigator.vibrate(0);
  });

  els.soundBtn.addEventListener('click', async () => {
    const context = getAudioContext();
    if (!context) {
      els.soundBtn.textContent = 'Som indisponível';
      return;
    }
    appState.soundEnabled = !appState.soundEnabled;
    els.soundBtn.setAttribute('aria-pressed', String(appState.soundEnabled));
    els.soundBtn.textContent = appState.soundEnabled ? 'Som: ligado' : 'Som: desligado';
    if (appState.soundEnabled) {
      try {
        if (context.state === 'suspended') await context.resume();
        playPattern([523, 659, 784]);
      } catch (error) {
        appState.soundEnabled = false;
        els.soundBtn.setAttribute('aria-pressed', 'false');
        els.soundBtn.textContent = 'Som: indisponível';
        console.warn('Não foi possível iniciar o áudio:', error);
      }
    }
  });

  els.modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      appState.mode = button.dataset.mode;
      els.modeButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      const wasOn = appState.isOn;
      setPowerState(false);
      if (wasOn) toggleTorch();
    });
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    appState.installPrompt = event;
    els.installBtn.classList.remove('hidden');
  });

  els.installBtn.addEventListener('click', async () => {
    if (!appState.installPrompt) return;
    appState.installPrompt.prompt();
    await appState.installPrompt.userChoice;
    appState.installPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service Worker falhou:', error));
  }
}

function initialize() {
  bindControls();
  updateIntensityLabel();
  updateStatusText();
  registerServiceWorker();
}

initialize();
