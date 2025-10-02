# Desafio Mottu – RFID Pátio de Motos (Sprint IoT/Visão)

> Protótipo funcional com **sensores simulados (IoT via HTTP + SSE)**, **dashboard em tempo real**, **persistência (SQLite)** e **métricas**. Opcionalmente, módulo de **Visão Computacional com Roboflow** para detecção de motos via webcam/câmera.

---

## 📌 Objetivo da Sprint

* Demonstrar **integração em tempo real** entre dispositivos (simulados) e backend.
* Exibir **dashboard/output visual** com eventos/alertas e métricas.
* Persistir dados e **evidenciar desempenho** (latência média/p95, throughput) com endpoints próprios.
* Entregar **casos de uso realistas**: *moto desaparecida*, *moto em zona errada*, *fluxo de cancela*.

Rubrica atendida:

* Comunicação sensores/visão ⇄ backend (até **30 pts**)
* Dashboard/output visual (até **30 pts**)
* Persistência e estruturação (até **20 pts**)
* Organização do código + documentação (**este README**) (até **20 pts**)

Penalidades evitadas: vídeo explicativo, dashboard funcional, dados persistidos e integração, projeto coerente.

---

## 🧰 Stack

* **Node.js 18+**
* **Express** (API + SSE)
* **SQLite** via `better-sqlite3` (modo WAL)
* **HTML/JS** (dashboard)
* **(Opcional)** Roboflow (Hosted API) para visão computacional

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

Regras implementadas:

* **Zone mismatch**: placa/identificador detectado em zona diferente da esperada → alerta `wrong_zone`.
* **Heartbeat (desaparecida)**: sem leituras por >30s → alerta `missing`.

---

## 📁 Estrutura do repositório

```
mottu-sprint-iot/
├─ server/
│  ├─ package.json
│  ├─ server.js          # API, SSE, regras, métricas, dashboard static
│  ├─ dashboard.html     # UI em tempo real
│  ├─ vc_proxy.js        # (opcional) proxy Roboflow
│  ├─ vc_client.html     # (opcional) cliente de webcam para visão
│  └─ events.db          # gerado automaticamente
└─ simulators/
   ├─ sim_rfid.js        # leitor RFID (3 zonas + 3 placas)
   ├─ sim_distance.js    # sensor distância/ocupação por zona
   └─ sim_gate.js        # atuador cancela (ouve /commands via SSE)
```

---

## ⚙️ Pré‑requisitos

* **Node.js 18+** (`node -v`)
* Não requer Docker. Sem compilação nativa (bibliotecas puras).

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

```bash
# A - RFID
node simulators/sim_rfid.js

# B - Distância
node simulators/sim_distance.js

# C - Cancela (atuador)
node simulators/sim_gate.js
```

### 3) Dashboard

* Acesse **[http://localhost:3000](http://localhost:3000)**
* Veja contadores/últimos eventos/alertas e **/metrics** atualizando.
* Ações: **Abrir/Fechar Cancela** (gera eventos no atuador).

---

## 🧪 Casos de teste (apresentação)

1. **Moto em zona errada**: o simulador RFID injeta ~10% de leituras em zonas incorretas → surge alerta `⚠️ Moto fora de posição`.
2. **Moto desaparecida**: pare `sim_rfid.js` por >30s → alerta `🚨 Moto desaparecida`.
3. **Fluxo da cancela**: acione **Abrir** → estados `opening → open`; acione **Fechar** → `closing → closed`.

> Todos os eventos ficam persistidos em `server/events.db`.

---

## 📊 Métricas & Endpoints úteis

* `GET /metrics` → `{ window_min, avg_latency_ms, p95_latency_ms, events_last5min, alerts_last5min }`
* `GET /events?limit=100` → últimas linhas (debug/histórico)
* `POST /ingest` → ingestão de telemetria
* `GET /stream` (SSE) → feed para dashboard
* `POST /command { target, action }` → comandos (ex.: `gate-1`, `open|close`)
* `GET /commands` (SSE) → stream de comandos para atuadores

Consultas SQL rápidas (SQLite):

```sql
-- últimos 50 eventos
SELECT * FROM events ORDER BY id DESC LIMIT 50;
-- alertas por tipo
SELECT kind, COUNT(*) FROM alerts GROUP BY kind;
-- latência média (somente com ts_device)
SELECT AVG(ts_server - ts_device) AS avg_latency FROM events WHERE ts_device IS NOT NULL;
```

---

## 🧩 Opção de Visão (Roboflow)

> **Opcional**: substitui/complenta sensores usando detecção de motos pela webcam.

### Variáveis de ambiente

```
ROBOFLOW_API_KEY=SEU_TOKEN
ROBOFLOW_MODEL=mottu-motorcycles
ROBOFLOW_VERSION=1
```

### Passos rápidos

1. **Backend**: em `server/vc_proxy.js` monte o proxy para `/vc/detect` (chama a Hosted API do Roboflow) e no `server.js`:

   ```js
   import { mountVcProxy } from './vc_proxy.js';
   mountVcProxy(app);
   ```
2. **Frontend**: abra `server/vc_client.html`, clique em **Start Webcam**. Cada detecção vira um **evento em `/ingest`** com `type: "rfid"` (reuso das regras / alertas), e as zonas são definidas por retângulos no próprio cliente.
3. **Demonstração**: mova a “moto” entre Z1/Z2/Z3 para gerar `wrong_zone`; esconda-a >30s para `missing`.

> Alternativas: Roboflow Inference (Docker offline), WebSocket em vez de SSE (1:1), RTSP via `ffmpeg` para gerar frames.

---

## 🧱 Estruturas de dados

**events** `(id, device_id, type, payload(json), ts_device, ts_server, zone_id)`
**alerts** `(id, kind, plate, expected_zone, actual_zone, ts)`

---

## 🐞 Troubleshooting

* **Porta ocupada** → altere `PORT` via env (`PORT=3001 npm start`).
* **better-sqlite3** com erro em CPU antiga/ARM → reinstale (`npm rebuild`) ou troque por `sqlite3`.
* **SSE bloqueado** em proxy → verifique CORS/NGINX e cabeçalhos `Cache-Control`, `Connection`.
* **Roboflow 401/403** → cheque `ROBOFLOW_*` e limite de requisições do plano.

---

## 👥 Integrantes

* Julio Samuel De Oliveira — RM557453
* Bruno Da Silva Souza — RM94346
* Leonardo Da Silva Pereira — RM557598

---
