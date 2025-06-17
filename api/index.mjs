// api/index.js
import express from 'express';
import serverless from 'serverless-http';
import history from '../server/history.mjs';   // ← reuse your logic
import health  from '../server/health.mjs';

const app = express();
app.get('/api/health',  health);
app.get('/api/history', history);

export const handler = serverless(app);   // Vercel will invoke handler()