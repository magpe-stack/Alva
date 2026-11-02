const AUTO_OFF_DELAY_MS = 60_000;

const appState = {
  isOn: false,
  mode: 'torch',
  intensity: 85,
  installPrompt: null,
  vibrationEnabled: false,
  soundEnabled: true,
  audioContext: null,
  wakeLockEnabled: false,
  wakeLock: null,
  autoOffTimer: null,
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
  redLightBtn: document.getElementById('redLightBtn'),
  wakeLockBtn: document.getElementById('wakeLockBtn'),
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

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  window.clearTimeout(appState.toastTimeout);
  appState.toastTimeout = window.setTimeout(() => els.toast.classList.remove('visible'), 3200);
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
  if (!appState.soundEnabled) return false;
  const context = getAudioContext();
  if (!context) return false;
  try {
    if (context.state !== 'running') await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration / 1000);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration / 1000 + 0.03);
    return true;
  } catch (error) {
    console.warn('Falha ao reproduzir som:', error);
    return false;
  }
}

function playPattern(frequencies) {
  frequencies.forEach((frequency, index) => {
    window.setTimeout(() => playTone(frequency, 170), index * 220);
  });
}

function setControlsHidden(hidden) {
  els.body.classList.toggle('controls-hidden', hidden);
}

function clearAutoOffTimer() {
  if (appState.autoOffTimer !== null) {
    window.clearTimeout(appState.autoOffTimer);
    appState.autoOffTimer = null;
  }
}

function scheduleAutoOff() {
  clearAutoOffTimer();
  if (!appState.isOn || appState.wakeLockEnabled) return;

  appState.autoOffTimer = window.setTimeout(() => {
    appState.autoOffTimer = null;
    setPowerState(false);
    showToast('Lanterna desligada após 1 minuto.');
  }, AUTO_OFF_DELAY_MS);
}

function stopModes() {
  if (appState.strobeInterval !== null) window.clearInterval(appState.strobeInterval);
  if (appState.sosInterval !== null) window.clearInterval(appState.sosInterval);
  appState.strobeInterval = null;
  appState.sosInterval = null;
  els.body.classList.remove('strobe-off');
}

function setPowerState(on) {
  appState.isOn = on;
  els.body.classList.toggle('torch-on', on);
  els.powerBtn.setAttribute('aria-label', on ? 'Desligar lanterna' : 'Ligar lanterna');
  els.powerBtn.title = on ? 'Desligar lanterna' : 'Ligar lanterna';
  setControlsHidden(on);
  if (on) scheduleAutoOff();
  else {
    clearAutoOffTimer();
    stopModes();
  }
}

function startStrobe() {
  if (appState.strobeInterval !== null) return;
  let visible = true;
  appState.strobeInterval = window.setInterval(() => {
    visible = !visible;
    els.body.classList.toggle('strobe-off', !visible);
    if (visible) {
      vibrateAction(40);
      playTone(780, 70);
    }
  }, 500);
}

function startSOS() {
  if (appState.sosInterval !== null) return;
  const pattern = [true, false, true, false, true, false, false, true, false, true, false, true, false, false, true, false, true, false, true, false, false];
  let index = 0;
  appState.sosInterval = window.setInterval(() => {
    const visible = pattern[index % pattern.length];
    els.body.classList.toggle('strobe-off', !visible);
    if (visible) {
      vibrateAction(35);
      playTone(660, 100);
    }
    index += 1;
  }, 350);
}

function applyMode() {
  stopModes();
  if (!appState.isOn) return;
  els.body.classList.add('torch-on');
  if (appState.mode === 'sos') startSOS();
  if (appState.mode === 'strobe') startStrobe();
}

async function toggleTorch() {
  if (appState.isOn) {
    setPowerState(false);
    await playTone(440, 130);
    return;
  }
  setPowerState(true);
  vibrateAction(80);
  await playTone(660, 150);
  applyMode();
}

async function requestWakeLock() {
  if (!appState.wakeLockEnabled || document.visibilityState !== 'visible') return;
  try {
    appState.wakeLock = await navigator.wakeLock.request('screen');
    clearAutoOffTimer();
    appState.wakeLock.addEventListener('release', () => {
      appState.wakeLock = null;
      if (appState.wakeLockEnabled) scheduleAutoOff();
    }, { once: true });
  } catch (error) {
    appState.wakeLockEnabled = false;
    els.wakeLockBtn.setAttribute('aria-pressed', 'false');
    els.wakeLockBtn.setAttribute('aria-label', 'Manter tela ligada');
    els.wakeLockBtn.title = 'Manter tela ligada';
    scheduleAutoOff();
    showToast('Não foi possível manter a tela ligada.');
  }
}

async function setWakeLockEnabled(enabled) {
  appState.wakeLockEnabled = enabled;
  els.wakeLockBtn.setAttribute('aria-pressed', String(enabled));
  els.wakeLockBtn.setAttribute('aria-label', enabled ? 'Desativar tela sempre ligada' : 'Manter tela ligada');
  els.wakeLockBtn.title = enabled ? 'Desativar tela sempre ligada' : 'Manter tela ligada';
  if (!enabled) {
    if (appState.wakeLock) await appState.wakeLock.release();
    appState.wakeLock = null;
    scheduleAutoOff();
    return;
  }
  if (!('wakeLock' in navigator)) {
    appState.wakeLockEnabled = false;
    els.wakeLockBtn.setAttribute('aria-pressed', 'false');
    els.wakeLockBtn.setAttribute('aria-label', 'Manter tela ligada');
    els.wakeLockBtn.title = 'Manter tela ligada';
    scheduleAutoOff();
    showToast('Manter tela ligada não está disponível.');
    return;
  }
  await requestWakeLock();
}

function handleDoubleTap(event) {
  if (!appState.isOn || event.target.closest('button, input, a')) return;
  const now = Date.now();
  const point = { x: event.clientX, y: event.clientY };
  const nearPrevious = appState.lastTapPoint && Math.hypot(point.x - appState.lastTapPoint.x, point.y - appState.lastTapPoint.y) < 70;
  if (now - appState.lastTapAt <= 450 && nearPrevious) {
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
    appState.intensity = Number(event.currentTarget.value);
    updateIntensityLabel();
  });

  els.modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      appState.mode = button.dataset.mode;
      els.modeButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      applyMode();
    });
  });

  els.vibrateBtn.addEventListener('click', () => {
    if (typeof navigator.vibrate !== 'function') {
      showToast('Vibração indisponível neste dispositivo.');
      return;
    }
    appState.vibrationEnabled = !appState.vibrationEnabled;
    els.vibrateBtn.setAttribute('aria-pressed', String(appState.vibrationEnabled));
    els.vibrateBtn.setAttribute('aria-label', appState.vibrationEnabled ? 'Desativar vibração' : 'Ativar vibração');
    els.vibrateBtn.title = appState.vibrationEnabled ? 'Desativar vibração' : 'Vibração';
    navigator.vibrate(appState.vibrationEnabled ? [120, 60, 120] : 0);
  });

  els.soundBtn.addEventListener('click', async () => {
    appState.soundEnabled = !appState.soundEnabled;
    els.soundBtn.setAttribute('aria-pressed', String(appState.soundEnabled));
    els.soundBtn.setAttribute('aria-label', appState.soundEnabled ? 'Desativar som' : 'Ativar som');
    els.soundBtn.title = appState.soundEnabled ? 'Som ligado' : 'Ativar som';
    if (appState.soundEnabled) {
      const context = getAudioContext();
      if (!context) {
        appState.soundEnabled = false;
        els.soundBtn.setAttribute('aria-pressed', 'false');
        showToast('Som indisponível neste navegador.');
        return;
      }
      try {
        if (context.state !== 'running') await context.resume();
        playPattern([523, 659, 784]);
      } catch (error) {
        appState.soundEnabled = false;
        els.soundBtn.setAttribute('aria-pressed', 'false');
        showToast('Não foi possível ativar o som.');
      }
    }
  });

  els.redLightBtn.addEventListener('click', () => {
    const enabled = !els.body.classList.contains('red-light');
    els.body.classList.toggle('red-light', enabled);
    els.redLightBtn.setAttribute('aria-pressed', String(enabled));
    els.redLightBtn.setAttribute('aria-label', enabled ? 'Desativar luz vermelha' : 'Ativar luz vermelha');
    els.redLightBtn.title = enabled ? 'Desativar luz vermelha' : 'Luz vermelha';
  });

  els.wakeLockBtn.addEventListener('click', () => setWakeLockEnabled(!appState.wakeLockEnabled));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
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
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then((registration) => registration.update())
    .catch((error) => console.warn('Service Worker falhou:', error));
}

function initialize() {
  bindControls();
  updateIntensityLabel();
  updateNetworkStatus();
  registerServiceWorker();
}

initialize();
