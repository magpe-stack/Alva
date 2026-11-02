function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem('alva-refreshing-worker')) return;
    sessionStorage.setItem('alva-refreshing-worker', 'true');
    window.location.reload();
  });

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then((registration) => registration.update())
    .catch((error) => console.warn('Service Worker falhou:', error));
}
