const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_FOLDER = path.join(__dirname, 'dist', 'PedidoPro_UI', 'browser');

// Proxy /api requests to backend (handles target with or without https://)
let rawTarget = process.env.API_URL || 'http://pedidoproapi.railway.internal:3000';
if (!rawTarget.startsWith('http://') && !rawTarget.startsWith('https://')) {
  rawTarget = `https://${rawTarget}`;
}
// Remove trailing slash if present
rawTarget = rawTarget.replace(/\/+$/, '');
const API_TARGET = rawTarget;

console.log(`Configurando Proxy /api -> ${API_TARGET}`);

app.use('/api', createProxyMiddleware({
  target: API_TARGET,
  changeOrigin: true,
  secure: false,
  pathRewrite: (pathStr, req) => {
    // Asegurar que el path final mantenga siempre el prefijo /api/
    const cleanPath = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
    return cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`;
  },
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error('Error en proxy:', err.message);
    res.status(502).json({ message: 'Error de conexión con el backend: ' + err.message });
  }
}));

// Serve static assets
app.use(express.static(DIST_FOLDER));

// SPA wildcard fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_FOLDER, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PedidoPro UI corriendo en el puerto ${PORT}`);
  console.log(`Proxy /api redirigiendo a: ${API_TARGET}`);
});
