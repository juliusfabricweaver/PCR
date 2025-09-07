const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock drafts endpoints
app.get('/api/drafts', (req, res) => {
  res.json({ success: true, drafts: [] });
});

app.post('/api/drafts', (req, res) => {
  console.log('Draft save request:', req.body);
  res.json({ success: true, id: Date.now(), expires_at: new Date(Date.now() + 86400000).toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});