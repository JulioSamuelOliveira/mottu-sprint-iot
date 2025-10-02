import EventSource from 'eventsource';

const ENDPOINT = 'http://localhost:3000/ingest';
const CMDSTREAM = 'http://localhost:3000/commands';
const fetchJson = (url, body) =>
  fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });

let state = 'closed';

function sendStatus(){
  const body = { device_id:'gate-1', type:'gate', payload:{ state }, ts_device: Date.now(), zone_id: null };
  fetchJson(ENDPOINT, body);
}

function handle(action){
  if (action === 'open' && state !== 'open') { state = 'opening'; sendStatus(); setTimeout(()=>{state='open';sendStatus();}, 1200); }
  if (action === 'close' && state !== 'closed') { state = 'closing'; sendStatus(); setTimeout(()=>{state='closed';sendStatus();}, 1200); }
}

function start(){
  const es = new EventSource(CMDSTREAM);
  es.onmessage = (m) => {
    try {
      const { target, action } = JSON.parse(m.data);
      if (target === 'gate-1') handle(action);
    } catch { /* no-op */ }
  };
  sendStatus(); // estado inicial
  console.log('Gate simulator running');
}

start();
