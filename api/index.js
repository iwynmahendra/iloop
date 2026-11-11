// Vercel serverless entry: the whole Express API as one function. vercel.json rewrites /api/* and /health here.
import { createApp } from '../apps/api/dist/app.js';

export default createApp();
