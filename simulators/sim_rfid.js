import fetch from "node-fetch";

const BASE = process.env.TARGET_BASE || "http://localhost:3000";
const DEVICE = "rfid-1";
const TAGS = ["MOT-1001","MOT-1002","MOT-2003","MOT-7777","MOT-8888"];

async function tick() {
  const tag = TAGS[Math.floor(Math.random()*TAGS.length)];
  const body = {
    deviceId: DEVICE,
    sensorType: "rfid",
    value: tag,
    ts: Date.now() - Math.floor(Math.random()*200) // simula jitter
  };
  try {
    await fetch(`${BASE}/ingest`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  } catch {}
}

setInterval(tick, 700);
console.log(`[sim_rfid] publishing to ${BASE} as ${DEVICE}`);
