require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');

app.use(cors());
app.use(express.json());

const chatwootRoutes = require('./routes/chatwoot');
const kanbanRoutes = require('./routes/kanban');
const boardsRoutes = require('./routes/boards');
const leadsRoutes = require('./routes/leads');
const dispatchesRoutes = require('./routes/dispatches');
const reportsRoutes = require('./routes/reports');

// Initialize Cron Jobs
require('./cron');

app.use('/api/config', chatwootRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/dispatches', dispatchesRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.get(/^(?!\/api|\/healthz).*/, (_req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
