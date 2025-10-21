import { jwt } from 'hono/jwt';

import env from '../lib/env.js';

// JWT secret key
const JWT_SECRET = env.JWT_SECRET;

// Middleware to verify JWT
const authMiddleware = jwt({ secret: JWT_SECRET });

export default authMiddleware;
