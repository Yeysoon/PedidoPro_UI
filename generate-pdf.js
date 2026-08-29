import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generatePdf() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\EdgeCore\\151.0.4129.107\\msedge.exe';
  const htmlPath = path.resolve(__dirname, '..', 'PedidoPro_UI_Documentacion.html');
  const outputPath = path.resolve(__dirname, '..', 'PedidoPro_UI_Documentacion.pdf');

  console.log('Iniciando Chromium/Edge headless...');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  console.log('Cargando HTML...');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  console.log('Generando archivo PDF...');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      right: '0mm',
      bottom: '0mm',
      left: '0mm'
    }
  });

  await browser.close();
  console.log('¡PDF generado exitosamente en:', outputPath);
}

generatePdf().catch(err => {
  console.error('Error generando PDF:', err);
  process.exit(1);
});
