import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { SlicePipe, CommonModule } from '@angular/common';
import { ReportesService } from '../../core/services/reportes.service';
import { MesasService } from '../../core/services/mesas.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { VentaReporte, ProductoTop, Mesa } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import Swal from 'sweetalert2';

interface TransactionActivity {
  id: string;
  initials: string;
  initialClass: string;
  name: string;
  mesaTipo: string;
  date: string;
  status: string;
  statusType: 'success' | 'danger' | 'warning' | 'info';
  amount: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [SlicePipe, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private alert = inject(AlertService);
  private reportesSvc = inject(ReportesService);
  private mesasSvc = inject(MesasService);
  private usuariosSvc = inject(UsuariosService);

  user = signal(this.auth.getUser());
  loading = signal(true);

  // Period filter
  selectedPeriod = signal<'weekly' | 'monthly' | 'yearly'>('monthly');

  ventas = signal<VentaReporte[]>([]);
  productosTop = signal<ProductoTop[]>([]);
  mesas = signal<Mesa[]>([]);
  usuariosCount = signal<number>(0);

  totalHoy = signal(0);
  mesasLibres = signal(0);
  mesasOcupadas = signal(0);

  occupancyRate = computed(() => {
    const total = this.mesas().length;
    if (total === 0) return '0%';
    const ocupadas = this.mesasOcupadas();
    return Math.round((ocupadas / total) * 100) + '%';
  });

  // Sample recent operational transactions matching the PrimeNG table style
  recentActivity = signal<TransactionActivity[]>([
    { id: '#1254', initials: 'AE', initialClass: 'avatar-indigo', name: 'Amy Elsner', mesaTipo: 'Mesa 04 (Salón)', date: 'Hoy, 13:45', status: 'Pagado', statusType: 'success', amount: 'Q 345.00' },
    { id: '#2355', initials: 'AF', initialClass: 'avatar-sky', name: 'Anna Fali', mesaTipo: 'Mesa 12 (Terraza)', date: 'Hoy, 13:20', status: 'En Cocina', statusType: 'info', amount: 'Q 180.50' },
    { id: '#1235', initials: 'SS', initialClass: 'avatar-emerald', name: 'Stephen Shaw', mesaTipo: 'Para Llevar', date: 'Hoy, 12:50', status: 'Listo', statusType: 'success', amount: 'Q 95.00' },
    { id: '#4512', initials: 'MR', initialClass: 'avatar-amber', name: 'Marcos Ruiz', mesaTipo: 'Mesa 02 (Salón)', date: 'Hoy, 12:15', status: 'Pendiente', statusType: 'warning', amount: 'Q 260.00' },
    { id: '#5621', initials: 'CL', initialClass: 'avatar-rose', name: 'Carmen López', mesaTipo: 'Mesa 08 (VIP)', date: 'Hoy, 11:30', status: 'Cancelado', statusType: 'danger', amount: 'Q 520.00' }
  ]);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.reportesSvc.getVentas().subscribe({
      next: v => {
        this.ventas.set(v);
        const lastVenta = v[v.length - 1];
        this.totalHoy.set(lastVenta ? lastVenta.total_ventas : 2840.50);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.reportesSvc.getProductosTop().subscribe({
      next: p => this.productosTop.set(p.slice(0, 5))
    });

    this.mesasSvc.getMesas().subscribe({
      next: m => {
        this.mesas.set(m);
        this.mesasLibres.set(m.filter(x => x.estado === 'Libre').length);
        this.mesasOcupadas.set(m.filter(x => x.estado === 'Ocupada').length);
      }
    });

    this.usuariosSvc.getUsuarios().subscribe({
      next: u => this.usuariosCount.set(u.length)
    });
  }

  setPeriod(period: 'weekly' | 'monthly' | 'yearly') {
    this.selectedPeriod.set(period);
  }

  getBarHeight(val: number): string {
    const max = Math.max(...this.ventas().map(v => +v.total_ventas), 500);
    const pct = Math.min(Math.max((+val / max) * 100, 15), 100);
    return pct + '%';
  }

  getTopWidth(val: number): string {
    const max = Math.max(...this.productosTop().map(p => +p.total_vendido), 1);
    return Math.min(Math.max((+val / max) * 100, 10), 100) + '%';
  }

  formatCurrency(n: number): string {
    return 'Q ' + (+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  async openExportModal() {
    const result = await Swal.fire({
      title: 'Exportar Reporte Ejecutivo',
      text: 'Selecciona el formato en el que deseas exportar los datos actuales del Dashboard:',
      icon: 'info',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '<i class="pi pi-file-excel" style="margin-right: 6px;"></i> Descargar CSV (Excel)',
      denyButtonText: '<i class="pi pi-print" style="margin-right: 6px;"></i> Imprimir / PDF',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'swal-pedidopro-modal',
        confirmButton: 'btn btn-primary',
        denyButton: 'btn btn-secondary',
        cancelButton: 'btn btn-ghost'
      },
      buttonsStyling: false
    });

    if (result.isConfirmed) {
      this.exportCSV();
    } else if (result.isDenied) {
      this.exportPDF();
    }
  }

  exportCSV() {
    const period = this.selectedPeriod();
    const today = new Date().toLocaleString();
    const userName = this.user()?.nombre || 'Administrador';

    let csv = '\uFEFF'; // UTF-8 BOM para Excel
    csv += 'PEDIDOPRO - REPORTE EJECUTIVO Y OPERATIVO\n';
    csv += `Generado el:,${today}\n`;
    csv += `Generado por:,${userName}\n`;
    csv += `Período:,${period.toUpperCase()}\n\n`;

    // Resumen KPIs
    csv += '--- RESUMEN DE INDICADORES (KPIs) ---\n';
    csv += 'Métrica,Valor\n';
    csv += `Ventas del Día,"${this.formatCurrency(this.totalHoy())}"\n`;
    csv += `Mesas Disponibles,${this.mesasLibres()}\n`;
    csv += `Mesas Ocupadas,${this.mesasOcupadas()}\n`;
    csv += `Tasa de Ocupación,${this.occupancyRate()}\n\n`;

    // Historial de Ventas
    csv += '--- HISTORIAL DE VENTAS ---\n';
    csv += 'Fecha,Comprobantes Emitidos,Total Ventas (Q)\n';
    const ventasList = this.ventas().length ? this.ventas() : [];
    ventasList.forEach(v => {
      csv += `"${v.fecha}",${v.cantidad_facturas},"${(+v.total_ventas).toFixed(2)}"\n`;
    });
    csv += '\n';

    // Ranking Productos
    csv += '--- PLATILLOS Y BEBIDAS MÁS VENDIDOS ---\n';
    csv += 'Posición,Producto,Cantidad Vendida\n';
    const topList = this.productosTop().length ? this.productosTop() : [];
    topList.forEach((p, idx) => {
      csv += `${idx + 1},"${p.nombre_producto}",${p.total_vendido}\n`;
    });
    csv += '\n';

    // Actividad Reciente
    csv += '--- ACTIVIDAD RECIENTE DE COMANDAS / VENTAS ---\n';
    csv += 'ID,Atendido Por,Ubicación / Tipo,Fecha y Hora,Estado,Monto\n';
    this.recentActivity().forEach(item => {
      csv += `"${item.id}","${item.name}","${item.mesaTipo}","${item.date}","${item.status}","${item.amount}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `PedidoPro_Reporte_Dashboard_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.alert.successToast('Reporte CSV generado y descargado exitosamente');
  }

  exportPDF() {
    const dateStr = new Date().toLocaleString();
    const userName = this.user()?.nombre || 'Administrador';
    const total = this.formatCurrency(this.totalHoy());
    const libres = this.mesasLibres();
    const ocupadas = this.mesasOcupadas();
    const tasa = this.occupancyRate();

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      this.alert.warningToast('Por favor permite las ventanas emergentes en tu navegador para imprimir');
      return;
    }

    const ventasRows = (this.ventas().length ? this.ventas().slice(-7) : [])
      .map(v => `<tr><td>${v.fecha}</td><td>${v.cantidad_facturas}</td><td style="text-align:right;">${this.formatCurrency(v.total_ventas)}</td></tr>`)
      .join('');

    const topRows = (this.productosTop().length ? this.productosTop() : [])
      .map((p, i) => `<tr><td>#${i + 1}</td><td>${p.nombre_producto}</td><td style="text-align:right;">${p.total_vendido} pedidos</td></tr>`)
      .join('');

    const actRows = this.recentActivity()
      .map(a => `<tr><td>${a.id}</td><td>${a.name}</td><td>${a.mesaTipo}</td><td>${a.date}</td><td>${a.status}</td><td style="text-align:right;">${a.amount}</td></tr>`)
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Reporte Ejecutivo - PedidoPro</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 30px; color: #0f172a; background: #ffffff; line-height: 1.5; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
          .logo { font-size: 24px; font-weight: 800; color: #1e3a8a; }
          .meta { font-size: 12px; color: #64748b; text-align: right; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
          .kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; }
          .kpi-box .val { font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 5px; }
          .kpi-box .lbl { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; }
          h3 { font-size: 15px; margin: 25px 0 10px 0; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th { background: #f1f5f9; color: #475569; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; }
          td { padding: 8px 12px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">🍽️ PEDIDOPRO</div>
            <div style="font-size: 14px; color: #475569;">Informe Ejecutivo y Métricas de Rendimiento</div>
          </div>
          <div class="meta">
            <div><strong>Fecha:</strong> ${dateStr}</div>
            <div><strong>Generado por:</strong> ${userName}</div>
            <div><strong>Período:</strong> ${this.selectedPeriod().toUpperCase()}</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-box"><div class="lbl">Ventas del Día</div><div class="val">${total}</div></div>
          <div class="kpi-box"><div class="lbl">Mesas Libres</div><div class="val">${libres}</div></div>
          <div class="kpi-box"><div class="lbl">Mesas Ocupadas</div><div class="val">${ocupadas}</div></div>
          <div class="kpi-box"><div class="lbl">Tasa Ocupación</div><div class="val">${tasa}</div></div>
        </div>

        <h3>Historial de Ventas</h3>
        <table>
          <thead><tr><th>Fecha</th><th>Comprobantes</th><th style="text-align:right;">Total Facturado</th></tr></thead>
          <tbody>${ventasRows || '<tr><td colspan="3">Sin registros de ventas</td></tr>'}</tbody>
        </table>

        <h3>Platillos Más Pedidos</h3>
        <table>
          <thead><tr><th>Rank</th><th>Nombre del Producto</th><th style="text-align:right;">Cantidad Vendida</th></tr></thead>
          <tbody>${topRows || '<tr><td colspan="3">Sin registros</td></tr>'}</tbody>
        </table>

        <h3>Actividad Reciente</h3>
        <table>
          <thead><tr><th>ID</th><th>Atendido Por</th><th>Mesa / Servicio</th><th>Fecha / Hora</th><th>Estado</th><th style="text-align:right;">Monto</th></tr></thead>
          <tbody>${actRows}</tbody>
        </table>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    this.alert.successToast('Ventana de impresión generada');
  }
}

