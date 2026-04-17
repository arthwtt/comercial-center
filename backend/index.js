require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const chatwootRoutes = require('./routes/chatwoot');
app.use('/api/config', chatwootRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
