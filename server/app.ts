import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { authRoute } from './routes/authRoute';
import { serviceRoute } from './routes/serviceRoute';
import syncRoute from './routes/syncRoute';
import { userRoute } from './routes/userRoute';
import { whatsappRoute } from './routes/whatsappRoute';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const apiRoutes = app
  .basePath('/api/v1')
  .route('/auth', authRoute)
  .route('/users', userRoute)
  .route('/services', serviceRoute)
  .route('/sync', syncRoute)
  .route('/whatsapp', whatsappRoute);

// Serve files from public directory
app.get('/uploads/*', serveStatic({ root: './server/storage/app/public' }));

// Serve static files from the built frontend
app.get('*', serveStatic({ root: './frontend/dist' }));

// Fallback to index.html for client-side routing
app.get('*', serveStatic({ path: './frontend/dist/index.html' }));

export default app;
export type ApiRoutes = typeof apiRoutes;
