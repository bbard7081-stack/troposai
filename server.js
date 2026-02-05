require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/health', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', socket => {

});

// RingCentral webhook receiver for telephony/sessions
const CALLS_FILE = path.join(__dirname, 'calls.json');

async function loadCalls() {
  try {
    const data = await fs.readFile(CALLS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

async function saveCalls(calls) {
  await fs.writeFile(CALLS_FILE, JSON.stringify(calls, null, 2), 'utf8');
}

const callerLookupTable = {
  '+15551234567': 'Alice Example',
  '+15557654321': 'Bob Example'
};

function normalizeNumber(num) {
  if (!num) return '';
  return num.replace(/[^\d+]/g, '');
}

function lookupNumber(num) {
  const n = normalizeNumber(num);
  return callerLookupTable[n] || null;
}

async function addCall(event) {
  const calls = await loadCalls();
  const caller = event && (event.body?.from?.phoneNumber || event.body?.from?.extension?.phoneNumber || 'Unknown');
  const call = {
    id: Date.now(),
    ts: new Date().toISOString(),
    caller: caller,
    callerName: lookupNumber(caller),
    event
  };
  calls.unshift(call);
  // Keep only recent 200
  if (calls.length > 200) calls.splice(200);
  await saveCalls(calls);
  return call;
}

app.get('/calls', async (req, res) => {
  const calls = await loadCalls();
  res.json(calls);
});

app.post('/lookup', (req, res) => {
  const { phone } = req.body;
  const name = lookupNumber(phone);
  res.json({ phone, name });
});

app.post('/webhook', async (req, res) => {
  // RingCentral subscription validation: return the header value if present
  const validation = req.headers['validation-token'] || req.headers['Validation-Token'];
  if (validation) {
    return res.status(200).send(validation);
  }

  const event = req.body;

  // Persist and emit to clients for real-time logging / screen-pop
  try {
    const saved = await addCall(event);
    io.emit('incoming_call', saved);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Failed to persist call:', err);
    res.status(500).send('error');
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
