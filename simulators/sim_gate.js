import fetch from "node-fetch";

const BASE = process.env.TARGET_BASE || "http://localhost:3000";
const DEVICE = "gate-1";

async function pullCommands() {
  try {
    const r = await fetch(`${BASE}/commands?deviceId=${DEVICE}`);
    const cmds = await r.json();
    cmds.forEach(c => console.log(`[sim_gate] received command`, c));
  } catch {}
}

async function heartbeat() {
  const body = { deviceId: DEVICE, sensorType: "gate", value: Math.random() > 0.5 ? 1 : 0, ts: Date.now() };
  try {
    await fetch(`${BASE}/ingest`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  } catch {}
}

setInterval(heartbeat, 1200);
setInterval(pullCommands, 2000);
console.log(`[sim_gate] publishing to ${BASE} as ${DEVICE}`);
