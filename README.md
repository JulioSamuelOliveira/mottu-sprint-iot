# Organized Scan — Simulador IoT (RFID Pátio de Motos)

Protótipo funcional para pátio de motos com **simuladores IoT (Organized Scan)**, **API Node/Express**, **dashboard em tempo real (SSE)**, **persistência (SQLite)** e **métricas**.  
Opcional: **Visão Computacional (Roboflow)** para detecção por câmera.

---

## 🎯 Objetivo da Sprint

- Integrar **dispositivos simulados** com backend em **tempo real**.  
- Exibir **dashboard** com eventos, comandos e métricas (latência p95, TPS).  
- Persistir leituras e **suportar casos de uso**: moto desaparecida, zona errada, fluxo de cancela.

---

## 🧰 Stack

- **Node.js 18+**
- **Express** (API REST + SSE)
- **SQLite** (arquivo local)
- **HTML/JS** (dashboard estático)
- **(Opcional)** Roboflow (Hosted API) para visão computacional

---

## 🏗️ Arquitetura (visão geral)

```
[Organized Scan (RFID/Distância/Cancela)] --HTTP--> [API /ingest] --> [SQLite]
                                      │                  │
                                      ├------> [/metrics, /events]
                                      │
                                 SSE [/stream] ----> [Dashboard]

[Atuador cancela] <------ [GET /commands] <------ [POST /command]
```

**Regras demonstradas (exemplos)**
- **Zone mismatch**: placa/ID lida em zona diferente da esperada → alerta `wrong_zone`.
- **Heartbeat**: >30s sem leituras de uma moto → alerta `missing`.

---

## 📁 Estrutura do repositório

```
mottu-iot/
├─ docker-compose.yml
├─ README.md
├─ server/
│  ├─ package.json
│  ├─ .env.example
│  ├─ server.js          # API, SSE, métricas, comandos
│  ├─ openapi.yml        # contrato da API
│  └─ public/
│     └─ dashboard.html  # UI em tempo real
└─ simulators/           # Organized Scan (simuladores)
   ├─ package.json
   ├─ sim_rfid.js        # leitor RFID (placas em zonas)
   ├─ sim_gate.js        # cancela (também consome /commands)
   └─ sim_distance.js    # ultrassom/distância por vaga/zona
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

## ⚙️ Pré-requisitos

- **Node.js 18+** (`node -v`)
- (Opcional) **Docker** para subir tudo com um comando

---

## 🚀 Como rodar

### Opção A) Docker (recomendado para demo rápida)

```bash
docker compose up --build
# Backend:   http://localhost:3000
# Dashboard: http://localhost:3000/dashboard.html
```

### Opção B) Local (sem Docker)

```bash
# Backend
cd server
npm i
npm start
# -> http://localhost:3000

# Simuladores Organized Scan (outro terminal)
cd simulators
npm i
npm start
```

---

## 🔌 Endpoints principais

- `POST /ingest` — Ingestão de leitura `{ deviceId, sensorType: "rfid|distance|gate|other", value, ts? }`
- `GET /events?limit=100` — Últimos eventos (debug/histórico)
- `GET /metrics` — Latência média/p95/p99 e TPS (janela curta)
- `GET /stream` — **SSE** com eventos e comandos em tempo real (para dashboard)
- `POST /command` — Cria comando para device `{ deviceId, command, payload? }`
- `GET /commands?deviceId=...` — Comandos pendentes para um atuador (marca como “dispatched” ao ler)

Contrato OpenAPI: **`/openapi.yml`**

---

## 🖥️ Dashboard

- Acesse: `http://localhost:3000/dashboard.html`
- Mostra eventos ao vivo, métricas (amostras, p95, TPS) e envio de comandos (ex.: `open_gate`).
- O atuador (simulador **gate**) busca seus comandos em `GET /commands`.

---

## 🔐 Variáveis de ambiente

Arquivo: `server/.env.example`
```
PORT=3000
# ROBOTFLOW_TOKEN=your_token_here
```

---

## 🧪 Cenários de demonstração

1. **Fluxo de cancela**  
   - No dashboard, envie comando `open_gate` para `deviceId=gate-1`.  
   - O `sim_gate.js` busca em `/commands` e registra estado via `/ingest`.

2. **Moto em zona errada (wrong_zone)**  
   - O `sim_rfid.js` injeta leituras com alguma taxa de erro de zona → alerta visível no feed.

3. **Moto desaparecida (missing)**  
   - Pare o `sim_rfid.js` >30s → o sistema marca ausência e gera alerta.

*(Os alertas persistem no banco; consultar via `/events`.)*

---

## 🗃️ Modelo de dados (SQLite)

- **events**: `(id, deviceId, sensorType, value, clientTs, serverTs)`
- **commands**: `(id, deviceId, command, payload(json), createdAt, dispatched)`

SQL úteis:
```sql
SELECT * FROM events ORDER BY id DESC LIMIT 50;
SELECT deviceId, COUNT(*) FROM events GROUP BY deviceId;
SELECT AVG(serverTs - clientTs) AS avg_latency FROM events WHERE clientTs IS NOT NULL;
```

---

## 🧩 Visão Computacional (Opcional)

Integração com Roboflow (Hosted API) para detectar motos por câmera e transformar detecções em eventos `/ingest` (reuso de regras/zonas).  
Variáveis: `ROBOTFLOW_TOKEN`, `ROBOTFLOW_MODEL`, `ROBOTFLOW_VERSION`.

Fluxo sugerido:
- Backend expõe `/vc/detect` (proxy chama Roboflow).
- Frontend (`vc_client.html`) envia frames → backend → Roboflow → converte para eventos.

---

## 🛡️ Segurança & Observabilidade (próximos passos recomendados)

- **Autenticação de device**: JWT por device ou mTLS; **assinatura HMAC** com nonce (anti-replay).
- **MQTT (Mosquitto)**: pub/sub para escalabilidade e resiliência; HTTP como fallback.
- **Observabilidade**: Prometheus + Grafana (latência, TPS, filas de comando, erro/seg).
- **Teste & Qualidade**: Jest (unit/integration) + k6 (carga); CI (lint, test, build, docker push).

> Cego que costuma derrubar demo: **sem autenticação de device** e **sem MQTT**, a prova funciona, mas não escala nem fecha o mínimo de segurança.

---

## 🐞 Troubleshooting

- **Porta ocupada**: `PORT=3001 npm start`
- **SSE bloqueado**: conferir CORS/reverso; enviar cabeçalhos `Cache-Control` e `Connection: keep-alive`
- **SQLite em rede**: use local; para multi-instância, adotar um DB servidor
- **Falha de rede do simulador**: o Organized Scan reenvia periodicamente; use `commands` pull-based para robustez

---

## 👥 Integrantes

- Julio Samuel De Oliveira — RM557453  
- Bruno Da Silva Souza — RM94346  
- Leonardo Da Silva Pereira — RM557598
