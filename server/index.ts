import app from './app';

const port = process.env.PORT || 3000;

console.log(`Server is running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
