import app from './app';

const port = process.env.PORT || 3000;

console.log(`Server is running on port ${port}`);

console.log('env salt', JSON.stringify(process.env.HASH_SALT, null, 2));

export default {
  port,
  fetch: app.fetch,
};
