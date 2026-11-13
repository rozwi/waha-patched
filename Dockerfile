FROM devlikeapro/waha:latest-2026.10.1

COPY patch-status-ack.mjs /tmp/patch-status-ack.mjs
COPY patch-offline-queue.mjs /tmp/patch-offline-queue.mjs

RUN node /tmp/patch-status-ack.mjs \
  && node /tmp/patch-offline-queue.mjs \
  && node --check /app/node_modules/@adiwajshing/baileys/lib/Socket/messages-recv.js \
  && node --check /app/node_modules/@adiwajshing/baileys/lib/Socket/socket.js \
  && rm /tmp/patch-status-ack.mjs /tmp/patch-offline-queue.mjs
