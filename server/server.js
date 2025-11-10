import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

// Rate limit básico
const limiter = rateLimit({ windowMs: 1000, max: 15, standardHeaders: true, legacyHeaders: false });
app.use(limiter);

// --- SQLite ---
const db = new sqlite3.Database("./events.db");
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviceId TEXT NOT NULL,
      sensorType TEXT NOT NULL,
      value REAL NOT NULL,
      clientTs INTEGER NOT NULL,
      serverTs INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS commands(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviceId TEXT NOT NULL,
      command TEXT NOT NULL,
      payload TEXT,
      createdAt INTEGER NOT NULL,
      dispatched INTEGER NOT NULL DEFAULT 0
    )
  `);
});

// --- Validação payload ---
const ingestSchema = z.object({
  deviceId: z.string().min(1),
  sensorType: z.enum(["rfid", "distance", "gate", "other"]).default("other"),
  value: z.number(),
  ts: z.number().int().optional() // epoch ms
});

// --- Bus simples para SSE ---
const sseClients = new Set();
function broadcast(eventName, data) {
  const line = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(line); } catch {}
  }
}

// --- Endpoints ---
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

app.post("/ingest", (req, res) => {
  const parsed = ingestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { deviceId, sensorType, value, ts } = parsed.data;
  const clientTs = ts ?? Date.now();
  const serverTs = Date.now();

  db.run(
    `INSERT INTO events(deviceId, sensorType, value, clientTs, serverTs)
     VALUES(?,?,?,?,?)`,
    [deviceId, sensorType, value, clientTs, serverTs],
    function (err) {
      if (err) return res.status(500).json({ error: "db_insert_failed" });
      const row = { id: this.lastID, deviceId, sensorType, value, clientTs, serverTs };
      broadcast("event", row);
      return res.status(201).json(row);
    }
  );
});

app.get("/events", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "100", 10), 1000);
  db.all(
    `SELECT * FROM events ORDER BY id DESC LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_query_failed" });
      res.json(rows);
    }
  );
});

app.get("/metrics", (_req, res) => {
  // Janela: últimos 1000 eventos
  db.all(`SELECT clientTs, serverTs FROM events ORDER BY id DESC LIMIT 1000`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "db_query_failed" });

    const latencies = rows.map(r => Math.max(0, r.serverTs - r.clientTs)).sort((a,b)=>a-b);
    const avg = latencies.length ? (latencies.reduce((a,b)=>a+b,0) / latencies.length) : 0;
    const p = (q) => {
      if (!latencies.length) return 0;
      const idx = Math.ceil(q * latencies.length) - 1;
      return latencies[Math.max(0, Math.min(latencies.length-1, idx))];
    };
    // TPS (simples): eventos nos últimos 10s
    const now = Date.now();
    const in10s = rows.filter(r => now - r.serverTs <= 10_000).length;
    const tps = in10s / 10;

    res.json({
      samples: latencies.length,
      latency_ms: { avg: Math.round(avg), p50: p(0.5), p95: p(0.95), p99: p(0.99) },
      tps: Number(tps.toFixed(2))
    });
  });
});

app.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: hello\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

const commandSchema = z.object({
  deviceId: z.string().min(1),
  command: z.string().min(1),
  payload: z.any().optional()
});

app.post("/command", (req, res) => {
  const parsed = commandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { deviceId, command, payload } = parsed.data;
  const createdAt = Date.now();
  db.run(
    `INSERT INTO commands(deviceId, command, payload, createdAt) VALUES(?,?,?,?)`,
    [deviceId, command, JSON.stringify(payload ?? null), createdAt],
    function (err) {
      if (err) return res.status(500).json({ error: "db_insert_failed" });
      const row = { id: this.lastID, deviceId, command, payload, createdAt, dispatched: 0 };
      broadcast("command", row);
      res.status(201).json(row);
    }
  );
});

app.get("/commands", (req, res) => {
  const deviceId = String(req.query.deviceId || "");
  if (!deviceId) return res.status(400).json({ error: "missing_deviceId" });

  db.all(
    `SELECT * FROM commands WHERE deviceId = ? AND dispatched = 0 ORDER BY id ASC LIMIT 50`,
    [deviceId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_query_failed" });
      // Marca como dispatched
      const ids = rows.map(r => r.id);
      if (ids.length) {
        const placeholders = ids.map(_ => "?").join(",");
        db.run(`UPDATE commands SET dispatched = 1 WHERE id IN (${placeholders})`, ids);
      }
      res.json(rows);
    }
  );
});

// OpenAPI estático e dashboard
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.get("/openapi.yml", (_req, res) => res.sendFile(path.join(__dirname, "openapi.yml")));
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`IoT server listening on http://localhost:${PORT}`);
});
