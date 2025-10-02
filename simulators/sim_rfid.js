const ENDPOINT = 'http://localhost:3000/ingest';

const fetchJson = (url, body) =>
  fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });

const plates = ['PLT-1234','PLT-9876','PLT-5555'];
const zones = ['Z1','Z2','Z3'];

function randItem(a){ return a[Math.floor(Math.random()*a.length)]; }

async function tick(){
  const plate = randItem(plates);
  const wrong = Math.random() < 0.1; // 10% para gerar alerta
  const zone = wrong
    ? randItem(zones.filter(z => !((plate==='PLT-1234'&&z==='Z1')||(plate==='PLT-9876'&&z==='Z2')||(plate==='PLT-5555'&&z==='Z3'))))
    : (plate==='PLT-1234'?'Z1':plate==='PLT-9876'?'Z2':'Z3');

  const payload = { plate, reader_strength: Math.round(50 + 50*Math.random()) };
  const body = { device_id: `rfid-${zone}`, type:'rfid', payload, ts_device: Date.now(), zone_id: zone };
  await fetchJson(ENDPOINT, body);
}

setInterval(tick, 1500);
console.log('RFID simulator running');
