const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_FOLDER = path.join(__dirname, 'dist', 'PedidoPro_UI', 'browser');

app.use(express.static(DIST_FOLDER));

app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_FOLDER, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PedidoPro UI corriendo en el puerto ${PORT}`);
});
