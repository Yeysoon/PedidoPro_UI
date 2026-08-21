const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_FOLDER = path.join(__dirname, 'dist', 'PedidoPro_UI', 'browser');

// Proxy /api requests to backend (supports internal Railway network or API_URL env)
const API_TARGET = process.env.API_URL || 'http://pedidoproapi.railway.internal:3000';

app.use('/api', createProxyMiddleware({
  target: API_TARGET,
  changeOrigin: true,
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error('Error al conectar con el backend API:', err.message);
    res.status(502).json({ message: 'Error de conexión con el backend' });
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
