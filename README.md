# Alva

PWA mobile-first de lanterna de tela com modos SOS e strobe, controles de intensidade, vibração e som, instalação e uso offline.

## Limitações de hardware no navegador

- O flash traseiro da câmera foi removido: o Chrome no dispositivo testado apenas acendia o indicador de uso da câmera, sem acender o LED traseiro. A API web de lanterna depende de suporte específico do navegador e do aparelho, então não é oferecida por esta versão.
- A lanterna usa uma camada clara na própria tela. O controle muda a intensidade visual dessa camada; navegadores não fornecem controle universal do brilho físico do painel.
- A API `ProximitySensor` não é suportada no Chrome para Android/PWA; não há sensor de proximidade funcional nesta versão. Os sensores foram removidos em vez de simulados.
- Vibração usa a API `navigator.vibrate` quando o navegador/aparelho permite. O botão ativa/desativa o recurso e dá uma confirmação tátil.
- Som usa Web Audio, iniciado por toque no botão para respeitar as regras de reprodução do navegador. O botão ativa/desativa o som e toca uma breve confirmação.

## Uso

Sirva os arquivos em HTTPS ou localhost para permitir instalação e service worker. No Chrome Android, após atualização, feche e reabra o PWA para carregar a nova versão. Se ainda aparecer a versão antiga, limpe os dados do site/cache do app e instale novamente.
