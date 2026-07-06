import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3000;

// Liveness check — proves the service is up.
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'night-shift-handover' });
});

app.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'server_started', port: Number(PORT) }));
});
