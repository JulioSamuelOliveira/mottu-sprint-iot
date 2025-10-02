import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mountVcProxy } from './vc_proxy.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
app.use(express.json());


// --- DB ---
const db = new Database(path.join(__dirname, 'events.db'));
db.pragma('journal_mode = WAL');


db.exec(`
CREATE TABLE IF NOT EXISTS events (
id INTEGER PRIMARY KEY AUTOINCREMENT,
device_id TEXT NOT NULL,
type TEXT NOT NULL, -- rfid | distance | gate
payload TEXT NOT NULL, -- JSON string
ts_device INTEGER, -- epoch ms enviado pelo dispositivo
ts_server INTEGER NOT NULL, -- epoch ms no servidor
zone_id TEXT
);
CREATE TABLE IF NOT EXISTS alerts (
id INTEGER PRIMARY KEY AUTOINCREMENT,
kind TEXT NOT NULL, -- missing | wrong_zone
plate TEXT,
expected_zone TEXT,
actual_zone TEXT,
ts INTEGER NOT NULL
);
`);


// --- Configuração de zonas e alocação (exemplo) ---
// plateHash -> zoneId esperada
const assignments = {
'PLT-1234': 'Z1',
'PLT-9876': 'Z2',
'PLT-5555': 'Z3'
};


// Última visão RFID por placa
const lastSeen = new Map(); // plateHash -> ts_server


// --- SSE Hubs ---
const clients = new Set(); // stream de eventos
const cmdClients = new Set(); // stream de comandos


function broadcastEvent(evt) {
const data = `data: ${JSON.stringify(evt)}\n\n`;
for (const res of clients) {
res.write(data);
}
}


function broadcastCommand(cmd) {
const data = `data: ${JSON.stringify(cmd)}\n\n`;
for (const res of cmdClients) {
res.write(data);
}
}


app.get('/stream', (req, res) => {
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.flushHeaders();
res.write(': connected\n\n');
clients.add(res);
req.on('close', () => clients.delete(res));
});


app.get('/commands', (req, res) => {
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.flushHeaders();
res.write(': connected\n\n');
cmdClients.add(res);
req.on('close', () => cmdClients.delete(res));
});

const PORT = process.env.PORT || 3000;
mountVcProxy(app);
app.listen(PORT, () => console.log(`Backend on http://localhost:${PORT}`));

import { mountVcProxy } from "./vc_proxy.js";
// ...
mountVcProxy(app);