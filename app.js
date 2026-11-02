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
  lastTapAt: 0,
  lastTapPoint: null,
  toastTimeout: null,
};

const els = {
  body: document.body,
  powerBtn: document.getElementById('powerBtn'),
  networkStatus: document.getElementById('networkStatus'),
  installBtn: document.getElementById('installBtn'),
  exitBtn: document.getElementById('exitBtn'),
  intensityRange: document.getElementById('intensityRange'),
  brightnessValue: document.getElementById('brightnessValue'),
  vibrateBtn: document.getElementById('vibrateBtn'),
  soundBtn: document.getElementById('soundBtn'),
  toast: document.getElementById('toast'),
  modeButtons: [...document.querySelectorAll('.mode-btn')],
};

function updateNetworkStatus() {
  const online = navigator.onLine;
  els.networkStatus.classList.toggle('online', online);
  els.networkStatus.classList.toggle('offline', !online);
  const label = online ? 'Internet online' : 'Internet offline';
  els.networkStatus.setAttribute('aria-label', label);
  els.networkStatus.title = label;
}

function updateIntensityLabel() {
  els.brightnessValue.textContent = `${appState.intensity}%`;
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

function setControlsHidden(hidden) {
  els.body.classList.toggle('controls-hidden', hidden);
}

function stopModes() {
  if (appState.strobeInterval) window.clearInterval(appState.strobeInterval);
  if (appState.sosInterval) window.clearInterval(appState.sosInterval);
  appState.strobeInterval = null;
  appState.sosInterval = null;
  els.body.classList.remove('strobe-off');
}

function setPowerState(nextState) {
  appState.isOn = nextState;
  els.body.classList.toggle('torch-on', nextState);
  if (nextState) setControlsHidden(true);
  else {
    stopModes();
    setControlsHidden(false);
  }
  els.powerBtn.setAttribute('aria-label', nextState ? 'Desligar lanterna' : 'Ligar lanterna');
  els.powerBtn.title = nextState ? 'Desligar lanterna' : 'Ligar lanterna';
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

function applySelectedMode() {
  stopModes();
  if (!appState.isOn) return;
  els.body.classList.add('torch-on');
  if (appState.mode === 'sos') startSOS();
  if (appState.mode === 'strobe') startStrobe();
}

function toggleTorch() {
  if (appState.isOn) {
    setPowerState(false);
    return;
  }
  setPowerState(true);
  vibrateAction(80);
  applySelectedMode();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  window.clearTimeout(appState.toastTimeout);
  appState.toastTimeout = window.setTimeout(() => els.toast.classList.remove('visible'), 3500);
}

function handleDoubleTap(event) {
  if (!appState.isOn || event.target.closest('button, input, a')) return;
  const now = Date.now();
  const point = { x: event.clientX, y: event.clientY };
  const closeToLastTap = appState.lastTapPoint && Math.hypot(point.x - appState.lastTapPoint.x, point.y - appState.lastTapPoint.y) < 70;
  if (now - appState.lastTapAt < 420 && closeToLastTap) {
    setControlsHidden(false);
    appState.lastTapAt = 0;
    appState.lastTapPoint = null;
    return;
  }
  appState.lastTapAt = now;
  appState.lastTapPoint = point;
}

function bindControls() {
  els.powerBtn.addEventListener('click', toggleTorch);
  els.intensityRange.addEventListener('input', (event) => {
    appState.intensity = Number(event.target.value);
    updateIntensityLabel();
  });

  els.vibrateBtn.addEventListener('click', () => {
    if (typeof navigator.vibrate !== 'function') {
      showToast('Vibração indisponível neste dispositivo.');
      return;
    }
    appState.vibrationEnabled = !appState.vibrationEnabled;
    els.vibrateBtn.setAttribute('aria-pressed', String(appState.vibrationEnabled));
    els.vibrateBtn.setAttribute('aria-label', appState.vibrationEnabled ? 'Desativar vibração' : 'Ativar vibração');
    navigator.vibrate(appState.vibrationEnabled ? [120, 60, 120] : 0);
  });

  els.soundBtn.addEventListener('click', async () => {
    const context = getAudioContext();
    if (!context) {
      showToast('Som indisponível neste navegador.');
      return;
    }
    appState.soundEnabled = !appState.soundEnabled;
    els.soundBtn.setAttribute('aria-pressed', String(appState.soundEnabled));
    els.soundBtn.setAttribute('aria-label', appState.soundEnabled ? 'Desativar som' : 'Ativar som');
    try {
      if (appState.soundEnabled) {
        if (context.state === 'suspended') await context.resume();
        playPattern([523, 659, 784]);
      }
    } catch (error) {
      appState.soundEnabled = false;
      els.soundBtn.setAttribute('aria-pressed', 'false');
      els.soundBtn.setAttribute('aria-label', 'Ativar som');
      showToast('Não foi possível ativar o som.');
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
      applySelectedMode();
    });
  });

  els.exitBtn.addEventListener('click', () => {
    window.close();
    window.setTimeout(() => {
      if (!window.closed) showToast('Feche o Alva pelo seletor de aplicativos do celular.');
    }, 250);
  });

  document.addEventListener('pointerup', handleDoubleTap);
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
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
  updateNetworkStatus();
  registerServiceWorker();
}

initialize();
