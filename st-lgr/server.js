require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const geoip = require('geoip-lite');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'visitors.csv');

// --- Discord Function ---
async function sendToDiscord(row) {
  if (!process.env.DISCORD_WEBHOOK) return;

  const [timestamp, ip, city, region, country, method, urlPath, userAgent, botTrap] = row;

  const msg = {
    content: `🌐 **New Visitor**\n
**IP:** ${ip}
**Location:** ${city || '??'}, ${region || '??'}, ${country || '??'}
**Page:** ${method} ${urlPath}
**Bot trap:** ${botTrap ? '⚠️ YES' : 'No'}
**User Agent:** ${userAgent}
⏰ ${timestamp}`
  };

  try {
    await axios.post(process.env.DISCORD_WEBHOOK, msg);
  } catch (err) {
    console.error('Discord webhook error:', err.message);
  }
}

// --- Save logs to CSV file ---
function appendLogRow(row) {
  const csvLine = row.map(val => `"${val || ''}"`).join(',') + '\n';
  fs.appendFileSync(LOG_FILE, csvLine, 'utf8');
}

// --- Middleware for logging ---
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip) || {};
  const timestamp = new Date().toISOString();
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Honeypot bot trap
  const botTrap = !!req.query._trap;

  const row = [
    timestamp,
    ip,
    geo.city || '',
    geo.region || '',
    geo.country || '',
    req.method,
    req.originalUrl,
    userAgent,
    botTrap
  ];

  appendLogRow(row);
  sendToDiscord(row); // 🚀 live ping to Discord

  next();
});

// --- Rate limiter (basic DDoS/bot protection) ---
const limiter = rateLimit({
  windowMs: 15 * 1000, // 15 sec
  max: 20,             // max 20 requests per IP
  handler: (req, res) => {
    res.status(429).send('Too many requests. Slow down.');
  }
});
app.use(limiter);

// --- Basic route ---
app.get('/', (req, res) => {
  res.send('<h1>hihi</h1>');
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Logger running at http://localhost:${PORT}`);
});
