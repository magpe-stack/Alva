# Alva

PWA de lanterna com foco em mobile first. Inclui:

- botão principal para ligar/desligar
- intensidade de brilho
- modo SOS
- modo strobe
- tema escuro e claro
- vibração e som
- instalação como app
- suporte offline via service worker
- suporte a tela em portrait e landscape

## Como usar

1. Abra o projeto em um servidor local HTTPS ou em localhost.
2. Acesse `index.html` pelo navegador.
3. Permita acesso à câmera quando solicitado para tentar usar o flash da câmera.

## Observações sobre flash

O flash da câmera só funciona em navegadores e dispositivos que expõem a API `torch` do `MediaStreamTrack`, o que normalmente é suportado em Android + Chrome/Edge. Em muitos outros navegadores ou plataformas, a lanterna cai para a simulação visual da tela por segurança e compatibilidade.

## Instalação

- O navegador pode mostrar um botão “Instalar” quando a web app está em um ambiente seguro.
- Em dispositivos iPhone/iPad, a instalação costuma aparecer via o menu de compartilhamento do Safari.

## Desenvolvimento

- `index.html`: estrutura da interface
- `style.css`: visual mobile first
- `app.js`: lógica do flash, modos, vibração, som e PWA
- `manifest.webmanifest`: instalação do app
- `sw.js`: suporte offline
