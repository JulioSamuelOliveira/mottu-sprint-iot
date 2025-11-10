import fetch from "node-fetch";

const BASE = process.env.TARGET_BASE || "http://localhost:3000";
const DEVICE = "dist-1";

async function tick() {
  // distância em cm (carro aproximando/afastando)
  const value = Math.round(50 + 30 * Math.sin(Date.now()/2000));
  const body = { deviceId: DEVICE, sensorType: "distance", value, ts: Date.now() };
  try {
    await fetch(`${BASE}/ingest`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  } catch {}
}

setInterval(tick, 900);
console.log(`[sim_distance] publishing to ${BASE} as ${DEVICE}`);
