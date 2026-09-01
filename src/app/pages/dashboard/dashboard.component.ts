import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SlicePipe, CommonModule } from '@angular/common';
import { ReportesService } from '../../core/services/reportes.service';
import { MesasService } from '../../core/services/mesas.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { CocinaService } from '../../core/services/cocina.service';
import { CajaService } from '../../core/services/caja.service';
import { InventarioService } from '../../core/services/inventario.service';
import { DashboardService, AdminStats, MeseroStats, CocinaStats, CajaStats } from '../../core/services/dashboard.service';
import { VentaReporte, ProductoTop, Mesa, Comanda, Pedido, Ingrediente } from '../../core/models';
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
  imports: [SlicePipe, CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private alert = inject(AlertService);
  private reportesSvc = inject(ReportesService);
  private mesasSvc = inject(MesasService);
  private usuariosSvc = inject(UsuariosService);
  private cocinaSvc = inject(CocinaService);
  private cajaSvc = inject(CajaService);
  private inventarioSvc = inject(InventarioService);
  private dashboardSvc = inject(DashboardService);
  private router = inject(Router);

  user = signal(this.auth.getUser());
  role = computed(() => this.auth.getRole());
  loading = signal(true);

  // Period filter
  selectedPeriod = signal<'weekly' | 'monthly' | 'yearly'>('monthly');

  // Role metrics
  adminStats = signal<AdminStats | null>(null);
  meseroStats = signal<MeseroStats | null>(null);
  cocinaStats = signal<CocinaStats | null>(null);
  cajaStats = signal<CajaStats | null>(null);

  // General datasets
  ventas = signal<VentaReporte[]>([]);
  productosTop = signal<ProductoTop[]>([]);
  mesas = signal<Mesa[]>([]);
  usuariosCount = signal<number>(0);
  comandasCocina = signal<Comanda[]>([]);
  pedidosListosCaja = signal<Pedido[]>([]);
  insumosCriticos = signal<Ingrediente[]>([]);

  totalHoy = signal(0);
  mesasLibres = signal(0);
  mesasOcupadas = signal(0);

  occupancyRate = computed(() => {
    const total = this.mesas().length;
    if (total === 0) return '0%';
    const ocupadas = this.mesasOcupadas();
    return Math.round((ocupadas / total) * 100) + '%';
  });

  // Recent activity dataset
  recentActivity = signal<TransactionActivity[]>([
    { id: '#1254', initials: 'AE', initialClass: 'avatar-indigo', name: 'Amy Elsner', mesaTipo: 'Mesa 04 (Salón)', date: 'Hoy, 13:45', status: 'Pagado', statusType: 'success', amount: 'Q 345.00' },
    { id: '#2355', initials: 'AF', initialClass: 'avatar-sky', name: 'Anna Fali', mesaTipo: 'Mesa 12 (Terraza)', date: 'Hoy, 13:20', status: 'En Cocina', statusType: 'info', amount: 'Q 180.50' },
    { id: '#1235', initials: 'SS', initialClass: 'avatar-emerald', name: 'Stephen Shaw', mesaTipo: 'Para Llevar', date: 'Hoy, 12:50', status: 'Listo', statusType: 'success', amount: 'Q 95.00' },
    { id: '#4512', initials: 'MR', initialClass: 'avatar-amber', name: 'Marcos Ruiz', mesaTipo: 'Mesa 02 (Salón)', date: 'Hoy, 12:15', status: 'Pendiente', statusType: 'warning', amount: 'Q 260.00' },
    { id: '#5621', initials: 'CL', initialClass: 'avatar-rose', name: 'Carmen López', mesaTipo: 'Mesa 08 (VIP)', date: 'Hoy, 11:30', status: 'Cancelado', statusType: 'danger', amount: 'Q 520.00' },
    { id: '#3421', initials: 'DR', initialClass: 'avatar-indigo', name: 'David Ramos', mesaTipo: 'Mesa 01 (Salón)', date: 'Hoy, 11:15', status: 'Pagado', statusType: 'success', amount: 'Q 410.00' },
    { id: '#7812', initials: 'SP', initialClass: 'avatar-emerald', name: 'Sofía Portillo', mesaTipo: 'Mesa 06 (Terraza)', date: 'Hoy, 10:45', status: 'En Cocina', statusType: 'info', amount: 'Q 195.00' },
    { id: '#9012', initials: 'JC', initialClass: 'avatar-sky', name: 'Julio Castillo', mesaTipo: 'Barra 02', date: 'Hoy, 10:30', status: 'Listo', statusType: 'success', amount: 'Q 85.00' },
    { id: '#6543', initials: 'LG', initialClass: 'avatar-amber', name: 'Laura Gómez', mesaTipo: 'Mesa 03 (VIP)', date: 'Hoy, 10:05', status: 'Pendiente', statusType: 'warning', amount: 'Q 310.00' },
    { id: '#8821', initials: 'PA', initialClass: 'avatar-rose', name: 'Pedro Alvarado', mesaTipo: 'Para Llevar', date: 'Hoy, 09:40', status: 'Pagado', statusType: 'success', amount: 'Q 120.00' },
    { id: '#4432', initials: 'EM', initialClass: 'avatar-indigo', name: 'Elena Morales', mesaTipo: 'Mesa 05 (Salón)', date: 'Hoy, 09:15', status: 'Pagado', statusType: 'success', amount: 'Q 275.50' },
    { id: '#1122', initials: 'RA', initialClass: 'avatar-sky', name: 'Rodrigo Aguilar', mesaTipo: 'Mesa 07 (Terraza)', date: 'Hoy, 08:50', status: 'Listo', statusType: 'success', amount: 'Q 160.00' },
    { id: '#7733', initials: 'VB', initialClass: 'avatar-emerald', name: 'Valeria Blanco', mesaTipo: 'Barra 01', date: 'Hoy, 08:30', status: 'Pagado', statusType: 'success', amount: 'Q 95.00' },
    { id: '#9988', initials: 'HG', initialClass: 'avatar-amber', name: 'Héctor Guerra', mesaTipo: 'Mesa 09 (VIP)', date: 'Hoy, 08:15', status: 'Pendiente', statusType: 'warning', amount: 'Q 380.00' },
    { id: '#3321', initials: 'MB', initialClass: 'avatar-rose', name: 'Mariana Barrios', mesaTipo: 'Para Llevar', date: 'Hoy, 08:00', status: 'Pagado', statusType: 'success', amount: 'Q 145.00' }
  ]);

  // Pagination & Filtering for Activity Table
  activityFilter = signal<string>('all');
  currentPage = signal<number>(1);
  pageSize = signal<number>(5);

  pendientesCount = computed(() => this.recentActivity().filter(a => a.status === 'Pendiente').length);

  filteredActivity = computed(() => {
    const f = this.activityFilter();
    let list = this.recentActivity();
    if (f !== 'all') {
      list = list.filter(a => a.status === f);
    }
    return list;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredActivity().length / this.pageSize())));

  paginatedActivity = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredActivity().slice(start, start + this.pageSize());
  });

  pagesList = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  startEntry = computed(() => this.filteredActivity().length ? (this.currentPage() - 1) * this.pageSize() + 1 : 0);
  endEntry = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filteredActivity().length));

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  togglePendientesFilter() {
    if (this.activityFilter() === 'Pendiente') {
      this.activityFilter.set('all');
      this.alert.infoToast('Mostrando todas las transacciones');
    } else {
      this.activityFilter.set('Pendiente');
      this.alert.warningToast('Filtrado: solo comandas pendientes');
    }
    this.currentPage.set(1);
  }

  async openActivityOptions() {
    const { value: option } = await Swal.fire({
      title: 'Opciones de Actividad',
      text: 'Selecciona una acción rápida o filtro:',
      icon: 'question',
      input: 'radio',
      inputOptions: {
        'all': '🔍 Ver Todas las Transacciones',
        'Pendiente': '⏳ Filtrar solo Pendientes (' + this.pendientesCount() + ')',
        'En Cocina': '🍳 Filtrar solo En Cocina',
        'Listo': '✅ Filtrar solo Listos para entrega',
        'Pagado': '💵 Filtrar solo Pagados',
        'cocina': '👨‍🍳 Ir al Módulo de Cocina',
        'caja': '🧾 Ir al Módulo de Caja'
      },
      inputValue: this.activityFilter() === 'all' ? 'all' : this.activityFilter(),
      showCancelButton: true,
      confirmButtonText: 'Aplicar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'swal-pedidopro-modal',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-ghost'
      },
      buttonsStyling: false
    });

    if (option) {
      if (option === 'cocina') {
        this.router.navigate(['/cocina']);
      } else if (option === 'caja') {
        this.router.navigate(['/caja']);
      } else {
        this.activityFilter.set(option);
        this.currentPage.set(1);
        this.alert.successToast('Filtro de actividad actualizado');
      }
    }
  }

  viewActivityDetail(item: TransactionActivity) {
    Swal.fire({
      title: `Detalle ${item.id}`,
      html: `
        <div style="text-align: left; font-size: 0.95rem; line-height: 1.8; color: #cbd5e1; padding: 10px 0;">
          <div style="margin-bottom: 8px;"><strong>Atendido por:</strong> ${item.name}</div>
          <div style="margin-bottom: 8px;"><strong>Ubicación:</strong> ${item.mesaTipo}</div>
          <div style="margin-bottom: 8px;"><strong>Hora de registro:</strong> ${item.date}</div>
          <div style="margin-bottom: 8px;"><strong>Estado actual:</strong> <span class="badge badge-${item.statusType}" style="padding: 3px 8px; border-radius: 6px;">${item.status}</span></div>
          <div style="margin-top: 12px; font-size: 1.1rem; color: #38bdf8;"><strong>Total:</strong> ${item.amount}</div>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Cerrar',
      customClass: {
        popup: 'swal-pedidopro-modal',
        confirmButton: 'btn btn-primary'
      },
      buttonsStyling: false
    });
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    const r = this.role();

    // Administrador: Cargar dashboard general y stats completos
    if (r === 'Administrador') {
      this.dashboardSvc.getAdminStats().subscribe({
        next: res => {
          if (res?.data) {
            this.adminStats.set(res.data);
            if (res.data.ventas_hoy !== undefined) this.totalHoy.set(res.data.ventas_hoy);
          }
        },
        error: () => {}
      });

      this.reportesSvc.getVentas().subscribe({
        next: (v: any) => {
          const list = Array.isArray(v) ? v : (v?.data || []);
          this.ventas.set(list);
          const lastVenta = list[list.length - 1];
          if (!this.totalHoy()) this.totalHoy.set(lastVenta ? lastVenta.total_ventas : 2840.50);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });

      this.reportesSvc.getProductosTop().subscribe({
        next: (p: any) => {
          const list = Array.isArray(p) ? p : [];
          this.productosTop.set(list.slice(0, 5));
        }
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

    } else if (r === 'Mesero') {
      // Mesero: Cargar estado del salón, mis pedidos y ocupación
      this.dashboardSvc.getMeseroStats().subscribe({
        next: res => {
          if (res?.data) {
            this.meseroStats.set(res.data);
          }
        },
        error: () => {}
      });

      this.mesasSvc.getMesas().subscribe({
        next: m => {
          this.mesas.set(m);
          this.mesasLibres.set(m.filter(x => x.estado === 'Libre').length);
          this.mesasOcupadas.set(m.filter(x => x.estado === 'Ocupada').length);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });

    } else if (r === 'Cocinero') {
      // Cocinero: Cargar comandas activas y alertas de stock bajo
      this.dashboardSvc.getCocinaStats().subscribe({
        next: res => {
          if (res?.data) {
            this.cocinaStats.set(res.data);
          }
        },
        error: () => {}
      });

      this.cocinaSvc.getComandas().subscribe({
        next: c => {
          this.comandasCocina.set(c);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });

      this.inventarioSvc.getIngredientes().subscribe({
        next: ings => {
          this.insumosCriticos.set(ings.filter(i => i.stock_actual <= 10));
        }
      });

    } else if (r === 'Cajero') {
      // Cajero: Cargar ingresos diarios y pedidos listos por cobrar
      this.dashboardSvc.getCajaStats().subscribe({
        next: res => {
          if (res?.data) {
            this.cajaStats.set(res.data);
            this.totalHoy.set(res.data.ingresos_hoy || 0);
          }
        },
        error: () => {}
      });

      this.cajaSvc.getPedidosListos().subscribe({
        next: p => {
          this.pedidosListosCaja.set(p);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
    }
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

