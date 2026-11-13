import fs from 'node:fs';

const file = '/app/node_modules/@adiwajshing/baileys/lib/Socket/messages-recv.js';
const mark = '/* waha-patched: status-ack (Baileys#2858) */';
let source = fs.readFileSync(file, 'utf8');

if (source.includes(mark)) {
  console.log('[status-ack] already applied');
  process.exit(0);
}

function replaceOnce(anchor, replacement, label) {
  const first = source.indexOf(anchor);
  if (first === -1 || source.indexOf(anchor, first + 1) !== -1) {
    throw new Error(`[status-ack] expected unique anchor not found: ${label}`);
  }
  source = source.replace(anchor, replacement);
}

replaceOnce(
  "    const offlineNodeProcessor = makeOfflineNodeProcessor(new Map([\n" +
    "        ['message', handleMessage],\n" +
    "        ['call', handleCall],\n" +
    "        ['receipt', handleReceipt],\n" +
    "        ['notification', handleNotification]\n" +
    "    ]), {",
  `    ${mark}\n` +
    "    const handleStatus = async (node) => {\n" +
    "        try {\n" +
    "            await sendMessageAck(node);\n" +
    "        }\n" +
    "        catch (error) {\n" +
    "            onUnexpectedError(error, 'acking status stanza');\n" +
    "        }\n" +
    "    };\n" +
    "    const offlineNodeProcessor = makeOfflineNodeProcessor(new Map([\n" +
    "        ['message', handleMessage],\n" +
    "        ['call', handleCall],\n" +
    "        ['receipt', handleReceipt],\n" +
    "        ['notification', handleNotification],\n" +
    "        ['status', handleStatus]\n" +
    "    ]), {",
  'offline node processor',
);

replaceOnce(
  "    ws.on('CB:notification', async (node) => {\n" +
    "        await processNode('notification', node, 'handling notification', handleNotification);\n" +
    "    });\n",
  "    ws.on('CB:notification', async (node) => {\n" +
    "        await processNode('notification', node, 'handling notification', handleNotification);\n" +
    "    });\n" +
    "    ws.on('CB:status', async (node) => {\n" +
    "        await processNode('status', node, 'acking status stanza', handleStatus).catch(error => onUnexpectedError(error, 'acking status stanza'));\n" +
    "    });\n",
  'live status listener',
);

fs.writeFileSync(file, source);
console.log('[status-ack] applied');
