const ENDPOINT = 'http://localhost:3000/ingest';
const fetchJson = (url, body) =>
  fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });

const zones = ['Z1','Z2','Z3'];

function distFor(zone){
  const base = zone==='Z1'? 30 : zone==='Z2'? 60 : 90; // variação por zona
  return Math.max(5, Math.round(base + (Math.random()*20 - 10)));
}

async function tick(){
  for (const z of zones){
    const payload = { distance_cm: distFor(z), threshold_occupied: 50 };
    const body = { device_id:`ultra-${z}`, type:'distance', payload, ts_device: Date.now(), zone_id: z };
    await fetchJson(ENDPOINT, body);
  }
}

setInterval(tick, 3000);
console.log('Distance simulator running');
