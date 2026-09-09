const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const environment = {
  production: true,
  apiUrl: isLocal ? 'http://localhost:8080' : 'https://pedidoproapi-production.up.railway.app'
};
