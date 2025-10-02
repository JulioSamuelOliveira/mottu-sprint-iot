# Desafio Mottu – RFID Pátio de Motos (Sprint IoT/Visão)

> Protótipo funcional com **sensores simulados (IoT via HTTP + SSE)**, **dashboard em tempo real**, **persistência (SQLite)** e **métricas**. Opcionalmente, **Visão Computacional com Roboflow** para detecção de motos via webcam/câmera.

---

## 📌 Objetivo da Sprint

* Demonstrar **integração em tempo real** entre dispositivos (simulados) e backend.
* Exibir **dashboard/output visual** com eventos/alertas e métricas.
* Persistir dados e **evidenciar desempenho** (latência média/p95, throughput).
* Entregar **casos de uso**: *moto desaparecida*, *moto em zona errada*, *fluxo de cancela*.

---

## 🧰 Stack

* **Node.js 18+**
* **Express** (API + SSE)
* **SQLite** via `better-sqlite3` (modo WAL)
* **HTML/JS** (dashboard)
* **(Opcional)** Roboflow (Hosted API) p/ visão computacional

---

## 🏗️ Arquitetura (visão geral)

```
[Simuladores IoT] --HTTP--> [API /ingest] --> [SQLite]
                                  │              │
                                  ├----> [/metrics, /events]
                                  │
                              SSE [/stream] --> [Dashboard]

[Atuador gate] <---SSE [/commands]--- [API /command]

(Opcional) Webcam -> [/vc/detect -> Roboflow] -> eventos em /ingest (reuso das regras)
```

**Regras**

* **Zone mismatch**: placa/ID na zona errada → alerta `wrong_zone`.
* **Heartbeat (desaparecida)**: >30s sem leituras → alerta `missing`.

---

## 📁 Estrutura do repositório

```
mottu-sprint-iot/
├─ server/
│  ├─ package.json
│  ├─ server.js          # API, SSE, regras, métricas, dashboard estático
│  ├─ dashboard.html     # UI em tempo real
│  ├─ vc_proxy.js        # (opcional) proxy Roboflow
│  ├─ vc_client.html     # (opcional) cliente de webcam p/ visão
│  └─ events.db          # gerado automaticamente
├─ simulators/
│  ├─ package.json       # (novo) dependência eventsource
│  ├─ sim_rfid.js        # leitor RFID (3 zonas + 3 placas)
│  ├─ sim_distance.js    # sensor distância/ocupação por zona
│  └─ sim_gate.js        # atuador cancela (ouve /commands via SSE)
└─ .gitignore            # ignora DB local e artefatos
```

**.gitignore sugerido**

```
node_modules/
npm-debug.log*
.DS_Store
server/events.db
server/events.db-shm
server/events.db-wal
```

---

## ⚙️ Pré‑requisitos

* **Node.js 18+** (`node -v`)
* Sem Docker obrigatório. Sem compilação nativa além do `better-sqlite3` (já pré‑compilado na maioria dos ambientes).

---

## 🚀 Como rodar

### 1) Backend

```bash
cd server
npm i
npm start
# Abra: http://localhost:3000
```

### 2) Simuladores (3 terminais)

> Os simuladores usam `eventsource` no Node para escutar comandos. Instale as deps dentro da pasta `simulators/`.

```bash
cd simulators
npm i
# A - RFID
node sim_rfid.js
# B - Distância
node sim_distance.js
# C - Cancela (atuador)
node sim_gate.js
```

### 3) Dashboard

* Acesse **[http://localhost:3000](http://localhost:3000)**
* Veja contadores/últimos eventos/alertas e **/metrics** atualizando.
* Ações: **Abrir/Fechar Cancela** (gera eventos no atuador).

---

## 🧪 Casos de teste (apresentação)

1. **Moto em zona errada**: o simulador RFID injeta ~10% de leituras erradas → alerta `⚠️ Moto fora de posição`.
2. **Moto desaparecida**: pare `sim_rfid.js` por >30s → alerta `🚨 Moto desaparecida`.
3. **Fluxo da cancela**: clique **Abrir** → estados `opening → open`; clique **Fechar** → `closing → closed`.

> Todos os eventos ficam persistidos em `server/events.db`.

---

## 📊 Endpoints & Métricas

* `GET /metrics` → `{ window_min, avg_latency_ms, p95_latency_ms, events_last5min, alerts_last5min }`
* `GET /events?limit=100` → últimas linhas (debug/histórico)
* `POST /ingest` → ingestão de telemetria
* `GET /stream` (SSE) → feed para dashboard
* `POST /command { target, action }` → comandos (ex.: `gate-1`, `open|close`)
* `GET /commands` (SSE) → stream de comandos p/ atuadores

**SQL úteis (SQLite)**

```sql
-- últimos 50 eventos
SELECT * FROM events ORDER BY id DESC LIMIT 50;
-- alertas por tipo
SELECT kind, COUNT(*) FROM alerts GROUP BY kind;
-- latência média (somente com ts_device)
SELECT AVG(ts_server - ts_device) AS avg_latency FROM events WHERE ts_device IS NOT NULL;
```

---

## 🧩 Visão Computacional (Roboflow) – Opcional

> Substitui/complementa sensores via detecção de motos pela webcam.

### Variáveis de ambiente

```
ROBOFLOW_API_KEY=SEU_TOKEN
ROBOFLOW_MODEL=mottu-motorcycles
ROBOFLOW_VERSION=1
```

### Passos rápidos

1. **Backend**: em `server/vc_proxy.js` exponha `/vc/detect` (chama a Hosted API do Roboflow) e, no `server.js`:

   ```js
   import { mountVcProxy } from './vc_proxy.js';
   mountVcProxy(app);
   ```
2. **Frontend**: abra `server/vc_client.html`, clique em **Start Webcam**. Cada detecção vira um **evento em `/ingest`** com `type: "rfid"` (reuso das regras/alertas). Zonas (Z1/Z2/Z3) definidas no cliente.
3. **Demonstração**: mova a “moto” entre zonas para gerar `wrong_zone`; esconda-a >30s para `missing`.

> Alternativas: Roboflow Inference (Docker offline), WebSocket em vez de SSE (1:1), RTSP via `ffmpeg` para frames.

---

## 🧱 Estruturas de dados

**events** `(id, device_id, type, payload(json), ts_device, ts_server, zone_id)`
**alerts** `(id, kind, plate, expected_zone, actual_zone, ts)`

---

## 🐞 Troubleshooting

* **Porta ocupada** → altere `PORT` via env (`PORT=3001 npm start`).
* **better-sqlite3** com erro em CPU antiga/ARM → `npm rebuild` ou usar `sqlite3`.
* **SSE bloqueado** (proxy/rede) → verifique CORS/NGINX e cabeçalhos `Cache-Control`, `Connection`.
* **Roboflow 401/403** → cheque `ROBOFLOW_*` e limites do plano.
* **EventSource no Node (sim_gate)** → garanta `simulators/package.json` com `eventsource` instalado.

---

## 👥 Integrantes

* Julio Samuel De Oliveira — RM557453
* Bruno Da Silva Souza — RM94346
* Leonardo Da Silva Pereira — RM557598
