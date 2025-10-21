import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { authRoute } from './routes/authRoute';
import { userRoute } from './routes/userRoute';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const apiRoutes = app.basePath('/api/v1').route('/auth', authRoute).route('/users', userRoute);

// Serve files from public directory
app.get('/uploads/*', serveStatic({ root: './server/storage/app/public' }));

// Serve static files from the built frontend
app.get('*', serveStatic({ root: './frontend/dist' }));

// Fallback to index.html for client-side routing
app.get('*', serveStatic({ path: './frontend/dist/index.html' }));

export default app;
export type ApiRoutes = typeof apiRoutes;
