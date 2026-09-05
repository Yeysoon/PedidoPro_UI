import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SlicePipe, CommonModule } from '@angular/common';
import { MesasService } from '../../core/services/mesas.service';
import { CocinaService } from '../../core/services/cocina.service';
import { CajaService } from '../../core/services/caja.service';
import { InventarioService } from '../../core/services/inventario.service';
import { DashboardService, AdminStats, MeseroStats, CocinaStats, CajaStats, ActividadRecienteItem, MixCategoriaItem, PlatilloTopItem } from '../../core/services/dashboard.service';
import { Mesa, Comanda, Pedido, Ingrediente } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import Swal from 'sweetalert2';

export interface TransactionActivity {
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

const CATEGORY_COLORS = [
  '#10B981', '#0EA5E9', '#F59E0B', '#6366F1', 
  '#EC4899', '#8B5CF6', '#14B8A6', '#F97316'
];

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
  private mesasSvc = inject(MesasService);
  private cocinaSvc = inject(CocinaService);
  private cajaSvc = inject(CajaService);
  private inventarioSvc = inject(InventarioService);
  private dashboardSvc = inject(DashboardService);
  private router = inject(Router);

  user = signal(this.auth.getUser());
  role = computed(() => this.auth.getRole());
  loading = signal(true);

  // Period filter: semanal, mensual, anual
  selectedPeriod = signal<'weekly' | 'monthly' | 'yearly'>('monthly');

  // Role metrics
  adminStats = signal<AdminStats | null>(null);
  meseroStats = signal<MeseroStats | null>(null);
  cocinaStats = signal<CocinaStats | null>(null);
  cajaStats = signal<CajaStats | null>(null);

  // Additional live collections
  mesas = signal<Mesa[]>([]);
  comandasCocina = signal<Comanda[]>([]);
  pedidosListosCaja = signal<Pedido[]>([]);
  insumosCriticos = signal<Ingrediente[]>([]);

  // Filtered / Paginated Activity Table
  recentActivity = signal<TransactionActivity[]>([]);
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

  occupancyRate = computed(() => {
    const total = this.adminStats()?.total_mesas || this.mesas().length;
    if (!total) return '0%';
    const ocupadas = this.adminStats()?.mesas_ocupadas ?? this.mesas().filter(m => m.estado === 'Ocupada').length;
    return Math.round((ocupadas / total) * 100) + '%';
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    const r = this.role();
    const period = this.selectedPeriod();

    if (r === 'Administrador') {
      this.dashboardSvc.getAdminStats(period).subscribe({
        next: res => {
          if (res?.data) {
            this.adminStats.set(res.data);
            if (res.data.actividad_reciente && res.data.actividad_reciente.length > 0) {
              this.recentActivity.set(this.mapActividadReciente(res.data.actividad_reciente));
            } else {
              this.recentActivity.set([]);
            }
          }
          this.loading.set(false);
        },
        error: e => {
          console.error('Error al cargar dashboard admin:', e);
          this.loading.set(false);
        }
      });

      this.mesasSvc.getMesas().subscribe({
        next: m => this.mesas.set(m),
        error: () => {}
      });

    } else if (r === 'Mesero') {
      this.dashboardSvc.getMeseroStats().subscribe({
        next: res => {
          if (res?.data) {
            this.meseroStats.set(res.data);
            if (res.data.mis_comandas && res.data.mis_comandas.length > 0) {
              const mapped = res.data.mis_comandas.map(c => ({
                id_pedido: c.id_pedido,
                atendido_por: this.user()?.nombre || 'Mesero',
                numero_mesa: c.numero_mesa,
                nombre_zona: c.nombre_zona || 'Salón',
                fecha_hora: c.fecha_hora,
                estado: c.estado,
                total: c.total
              }));
              this.recentActivity.set(this.mapActividadReciente(mapped));
            } else {
              this.recentActivity.set([]);
            }
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });

      this.mesasSvc.getMesas().subscribe({
        next: m => this.mesas.set(m),
        error: () => {}
      });

    } else if (r === 'Cocinero') {
      this.dashboardSvc.getCocinaStats().subscribe({
        next: res => {
          if (res?.data) {
            this.cocinaStats.set(res.data);
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });

      this.cocinaSvc.getComandas().subscribe({
        next: c => {
          this.comandasCocina.set(c);
          const mapped: ActividadRecienteItem[] = c.map(item => ({
            id_pedido: item.id_pedido,
            atendido_por: 'Comanda Cocina',
            numero_mesa: item.numero_mesa,
            nombre_zona: 'Cocina',
            fecha_hora: item.fecha_hora_creacion,
            estado: item.nombre_estado,
            total: item.detalles.reduce((acc, d) => acc + ((d.precio_unitario_historico || 0) * d.cantidad), 0)
          }));
          this.recentActivity.set(this.mapActividadReciente(mapped));
        },
        error: () => {}
      });

      this.inventarioSvc.getIngredientes().subscribe({
        next: ings => {
          this.insumosCriticos.set(ings.filter(i => i.stock_actual <= 10));
        },
        error: () => {}
      });

    } else if (r === 'Cajero') {
      this.dashboardSvc.getCajaStats(period).subscribe({
        next: res => {
          if (res?.data) {
            this.cajaStats.set(res.data);
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });

      this.cajaSvc.getPedidosListos().subscribe({
        next: p => {
          this.pedidosListosCaja.set(p);
          const mapped: ActividadRecienteItem[] = p.map(item => ({
            id_pedido: item.id_pedido,
            atendido_por: item.nombre_mesero || 'Mesero',
            numero_mesa: item.numero_mesa || 0,
            nombre_zona: 'Salón',
            fecha_hora: item.fecha_hora_creacion,
            estado: item.nombre_estado || 'Listo',
            total: item.detalles?.reduce((acc, d) => acc + ((d.precio_unitario_historico || 0) * d.cantidad), 0) || 0
          }));
          this.recentActivity.set(this.mapActividadReciente(mapped));
        },
        error: () => {}
      });
    }
  }

  setPeriod(period: 'weekly' | 'monthly' | 'yearly') {
    if (this.selectedPeriod() === period) return;
    this.selectedPeriod.set(period);
    this.load();
  }

  private mapActividadReciente(items: ActividadRecienteItem[]): TransactionActivity[] {
    const avatarColors = ['avatar-indigo', 'avatar-sky', 'avatar-emerald', 'avatar-amber', 'avatar-rose'];
    return items.map((item, idx) => {
      let statusType: 'success' | 'danger' | 'warning' | 'info' = 'info';
      if (['Servido', 'Pagado', 'Listo'].includes(item.estado)) {
        statusType = 'success';
      } else if (item.estado === 'Pendiente') {
        statusType = 'warning';
      } else if (item.estado === 'Cancelado') {
        statusType = 'danger';
      } else if (item.estado === 'En Preparación') {
        statusType = 'info';
      }

      const name = item.atendido_por || 'Colaborador';
      const initials = name.slice(0, 2).toUpperCase();
      const initialClass = avatarColors[idx % avatarColors.length];
      const mesaTipo = `Mesa ${item.numero_mesa || 'S/N'} (${item.nombre_zona || 'Salón'})`;
      const date = item.fecha_hora || 'Hoy';
      const amount = this.formatCurrency(item.total || 0);

      return {
        id: `#${item.id_pedido}`,
        initials,
        initialClass,
        name,
        mesaTipo,
        date,
        status: item.estado,
        statusType,
        amount
      };
    });
  }

  getBarHeight(val: number): string {
    const items = this.adminStats()?.actividad_ventas || [];
    const max = Math.max(...items.map(v => +v.total_ventas), 500);
    const pct = Math.min(Math.max((+val / max) * 100, 15), 100);
    return pct + '%';
  }

  getTopWidth(val: number): string {
    const items = this.adminStats()?.platillos_top || [];
    const max = Math.max(...items.map(p => +p.total_vendido), 1);
    return Math.min(Math.max((+val / max) * 100, 12), 100) + '%';
  }

  getCategoryColor(idx: number): string {
    return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
  }

  formatCurrency(n: number): string {
    return 'Q ' + (+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

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
        'En Preparación': '🍳 Filtrar solo En Preparación',
        'Listo': '✅ Filtrar solo Listos para entrega',
        'Servido': '🍽️ Filtrar solo Servidos',
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
    const stats = this.adminStats();

    let csv = '\uFEFF'; // UTF-8 BOM para Excel
    csv += 'PEDIDOPRO - REPORTE EJECUTIVO Y OPERATIVO\n';
    csv += `Generado el:,${today}\n`;
    csv += `Generado por:,${userName}\n`;
    csv += `Período:,${period.toUpperCase()}\n\n`;

    // Resumen KPIs
    csv += '--- RESUMEN DE INDICADORES (KPIs) ---\n';
    csv += 'Métrica,Valor\n';
    csv += `Ventas del Día,"${this.formatCurrency(stats?.ventas_hoy || 0)}"\n`;
    csv += `Ventas del Período,"${this.formatCurrency(stats?.ventas_periodo || 0)}"\n`;
    csv += `Facturas Emitidas en Período,${stats?.facturas_periodo || 0}\n`;
    csv += `Mesas Disponibles,${stats?.mesas_libres || 0}\n`;
    csv += `Mesas Ocupadas,${stats?.mesas_ocupadas || 0}\n`;
    csv += `Tasa de Ocupación,${this.occupancyRate()}\n\n`;

    // Historial de Ventas
    csv += '--- ACTIVIDAD DE VENTAS ---\n';
    csv += 'Fecha,Comprobantes Emitidos,Total Ventas (Q)\n';
    (stats?.actividad_ventas || []).forEach(v => {
      csv += `"${v.fecha}",${v.cantidad_facturas},"${(+v.total_ventas).toFixed(2)}"\n`;
    });
    csv += '\n';

    // Mix Categorías
    csv += '--- MIX DE FACTURACIÓN POR CATEGORÍA ---\n';
    csv += 'Categoría,Porcentaje,Cantidad Vendida,Total (Q)\n';
    (stats?.mix_facturacion || []).forEach(m => {
      csv += `"${m.nombre_categoria}",${m.porcentaje}%,${m.cantidad_vendida},"${(+m.total_categoria).toFixed(2)}"\n`;
    });
    csv += '\n';

    // Ranking Productos
    csv += '--- PLATILLOS Y BEBIDAS MÁS VENDIDOS ---\n';
    csv += 'Posición,Producto,Categoría,Cantidad Vendida,Total Ingresos (Q)\n';
    (stats?.platillos_top || []).forEach((p, idx) => {
      csv += `${idx + 1},"${p.nombre_producto}","${p.nombre_categoria || 'Menú'}",${p.total_vendido},"${(+(p.total_ingresos || 0)).toFixed(2)}"\n`;
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
    link.setAttribute('download', `PedidoPro_Reporte_Dashboard_${period}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.alert.successToast('Reporte CSV descargado exitosamente');
  }

  exportPDF() {
    const dateStr = new Date().toLocaleString();
    const userName = this.user()?.nombre || 'Administrador';
    const stats = this.adminStats();
    const totalHoy = this.formatCurrency(stats?.ventas_hoy || 0);
    const totalPer = this.formatCurrency(stats?.ventas_periodo || 0);
    const libres = stats?.mesas_libres || 0;
    const ocupadas = stats?.mesas_ocupadas || 0;
    const tasa = this.occupancyRate();

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      this.alert.warningToast('Por favor permite las ventanas emergentes en tu navegador para imprimir');
      return;
    }

    const ventasRows = (stats?.actividad_ventas || [])
      .map(v => `<tr><td>${v.fecha}</td><td>${v.cantidad_facturas}</td><td style="text-align:right;">${this.formatCurrency(v.total_ventas)}</td></tr>`)
      .join('');

    const mixRows = (stats?.mix_facturacion || [])
      .map(m => `<tr><td>${m.nombre_categoria}</td><td>${m.porcentaje}%</td><td>${m.cantidad_vendida} items</td><td style="text-align:right;">${this.formatCurrency(m.total_categoria)}</td></tr>`)
      .join('');

    const topRows = (stats?.platillos_top || [])
      .map((p, i) => `<tr><td>#${i + 1}</td><td>${p.nombre_producto}</td><td>${p.nombre_categoria || 'Menú'}</td><td style="text-align:right;">${p.total_vendido} pedidos</td></tr>`)
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
          <div class="kpi-box"><div class="lbl">Ventas del Día</div><div class="val">${totalHoy}</div></div>
          <div class="kpi-box"><div class="lbl">Ventas Período</div><div class="val">${totalPer}</div></div>
          <div class="kpi-box"><div class="lbl">Mesas Libres</div><div class="val">${libres}</div></div>
          <div class="kpi-box"><div class="lbl">Tasa Ocupación</div><div class="val">${tasa}</div></div>
        </div>

        <h3>Actividad de Ventas en el Período</h3>
        <table>
          <thead><tr><th>Fecha</th><th>Comprobantes</th><th style="text-align:right;">Total Facturado</th></tr></thead>
          <tbody>${ventasRows || '<tr><td colspan="3">Sin registros de ventas en este período</td></tr>'}</tbody>
        </table>

        <h3>Mix de Facturación por Categoría</h3>
        <table>
          <thead><tr><th>Categoría</th><th>Participación</th><th>Cantidad Items</th><th style="text-align:right;">Total</th></tr></thead>
          <tbody>${mixRows || '<tr><td colspan="4">Sin ventas por categoría registradas</td></tr>'}</tbody>
        </table>

        <h3>Platillos Más Pedidos</h3>
        <table>
          <thead><tr><th>Rank</th><th>Nombre del Producto</th><th>Categoría</th><th style="text-align:right;">Cantidad Vendida</th></tr></thead>
          <tbody>${topRows || '<tr><td colspan="4">Sin registros de platillos pedidos</td></tr>'}</tbody>
        </table>

        <h3>Actividad Reciente</h3>
        <table>
          <thead><tr><th>ID</th><th>Atendido Por</th><th>Mesa / Servicio</th><th>Fecha / Hora</th><th>Estado</th><th style="text-align:right;">Monto</th></tr></thead>
          <tbody>${actRows || '<tr><td colspan="6">Sin actividad reciente</td></tr>'}</tbody>
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
