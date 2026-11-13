import fs from 'node:fs';

const file = '/app/node_modules/@adiwajshing/baileys/lib/Socket/socket.js';
const mark = '/* waha-patched: offline-queue (Baileys#2810, WAHA#2349) */';
let source = fs.readFileSync(file, 'utf8');

if (source.includes(mark)) {
  console.log('[offline-queue] already applied');
  process.exit(0);
}

function replaceOnce(anchor, replacement, label) {
  const first = source.indexOf(anchor);
  if (first === -1 || source.indexOf(anchor, first + 1) !== -1) {
    throw new Error(`[offline-queue] expected unique anchor not found: ${label}`);
  }
  source = source.replace(anchor, replacement);
}

const originalPreviewHandler =
  "    ws.on('CB:ib,,offline_preview', async (node) => {\n" +
  "        logger.info('offline preview received', JSON.stringify(node));\n" +
  "        await sendNode({\n" +
  "            tag: 'ib',\n" +
  "            attrs: {},\n" +
  "            content: [{ tag: 'offline_batch', attrs: { count: '100' } }]\n" +
  "        });\n" +
  "    });";

const offlineQueuePatch = `    ${mark}
    const OFFLINE_BATCH_INTERVAL_MS = 5000;
    const OFFLINE_BATCH_MIN_REQUESTS = 200;
    let awaitingOfflineEnd = false;
    let offlineBatchRequests = 0;
    let offlineBatchLimit = OFFLINE_BATCH_MIN_REQUESTS;
    let offlineBatchTimer;
    let offlineBatchInFlight = false;
    const requestOfflineBatch = async () => {
        if (offlineBatchInFlight) {
            return;
        }
        offlineBatchInFlight = true;
        offlineBatchRequests++;
        try {
            await sendNode({
                tag: 'ib',
                attrs: {},
                content: [{ tag: 'offline_batch', attrs: { count: '100' } }]
            });
        }
        finally {
            offlineBatchInFlight = false;
        }
    };
    const stopOfflineBatchWatchdog = () => {
        awaitingOfflineEnd = false;
        if (offlineBatchTimer) {
            clearTimeout(offlineBatchTimer);
            offlineBatchTimer = undefined;
        }
    };
    const armOfflineBatchWatchdog = () => {
        if (!awaitingOfflineEnd) {
            return;
        }
        if (offlineBatchTimer) {
            clearTimeout(offlineBatchTimer);
        }
        offlineBatchTimer = setTimeout(() => {
            offlineBatchTimer = undefined;
            if (!awaitingOfflineEnd || !ws.isOpen) {
                return;
            }
            if (offlineBatchRequests >= offlineBatchLimit) {
                logger.warn({ requests: offlineBatchRequests }, 'offline queue still open after max batch requests, reconnecting');
                stopOfflineBatchWatchdog();
                ev.flush();
                void end(new Boom('Offline queue not drained', { statusCode: DisconnectReason.connectionClosed }));
                return;
            }
            logger.info({ request: offlineBatchRequests + 1 }, 'offline queue still open, requesting next offline batch');
            armOfflineBatchWatchdog();
            requestOfflineBatch().catch(error => logger.warn({ error }, 'failed to request next offline batch'));
        }, OFFLINE_BATCH_INTERVAL_MS);
    };
    socketEndHandlers.push(() => stopOfflineBatchWatchdog());
    ws.on('CB:ib,,offline_preview', async (node) => {
        const preview = getBinaryNodeChild(node, 'offline_preview')?.attrs;
        logger.info({ preview }, 'offline preview received');
        const total = Number(preview?.count);
        offlineBatchLimit = Math.max(offlineBatchLimit, Number.isFinite(total) ? Math.ceil(total / 50) + 20 : 0);
        if (awaitingOfflineEnd) {
            return;
        }
        awaitingOfflineEnd = true;
        armOfflineBatchWatchdog();
        try {
            await requestOfflineBatch();
        }
        catch (error) {
            logger.warn({ error }, 'failed to request offline batch');
        }
    });`;

replaceOnce(originalPreviewHandler, offlineQueuePatch, 'offline preview handler');
replaceOnce(
  "        logger.info(`handled ${offlineNotifs} offline messages/notifications`);",
  "        logger.info(`handled ${offlineNotifs} offline messages/notifications`);\n" +
    '        stopOfflineBatchWatchdog();',
  'offline queue completion',
);

fs.writeFileSync(file, source);
console.log('[offline-queue] applied');
