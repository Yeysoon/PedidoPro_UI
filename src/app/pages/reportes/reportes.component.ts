import { SlicePipe } from '@angular/common';
import { Component, signal, computed, OnInit, inject, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportesService } from '../../core/services/reportes.service';
import { CajaService, FacturaHistorial } from '../../core/services/caja.service';
import { AlertService } from '../../core/services/alert.service';
import { VentaReporte, ProductoTop } from '../../core/models';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [SlicePipe, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss'
})
export class ReportesComponent implements OnInit {
  Math = Math;
  private svc = inject(ReportesService);
  private cajaSvc = inject(CajaService);
  private alert = inject(AlertService);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.calendar-filter-wrapper')) {
      this.showCalendar.set(false);
    }
  }

  ventas       = signal<VentaReporte[]>([]);
  productosTop = signal<ProductoTop[]>([]);
  loading      = signal(true);
  totalGeneral = signal(0);
  avgDiario    = signal(0);

  // Historial de Facturas y Pedidos Cobrados
  facturas = signal<FacturaHistorial[]>([]);
  busqueda = signal<string>('');
  downloadingPdfId = signal<number | null>(null);

  // Modal Resumen / Detalle de Factura Emitida
  selectedFacturaDetalle = signal<any | null>(null);
  showFacturaModal = signal<boolean>(false);
  loadingFacturaDetalle = signal<boolean>(false);

  // Filtro de Calendario
  showCalendar = signal<boolean>(false);
  calendarMode = signal<'mes' | 'dia'>('mes');
  selectedYear = signal<number>(new Date().getFullYear());
  selectedMonth = signal<number>(new Date().getMonth());
  selectedDay = signal<number | null>(null);

  mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  mesesNombresCompletos = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  fechaFiltroLabel = computed(() => {
    const y = this.selectedYear();
    const m = this.selectedMonth();
    const d = this.selectedDay();
    if (d !== null) {
      return `${String(d).padStart(2, '0')} ${this.mesesNombresCompletos[m]} ${y}`;
    }
    return `${this.mesesNombresCompletos[m]} ${y}`;
  });

  diasMesArray = computed(() => {
    const y = this.selectedYear();
    const m = this.selectedMonth();
    const primerDiaSemana = new Date(y, m, 1).getDay();
    const totalDias = new Date(y, m + 1, 0).getDate();
    
    const blanks = Array.from({ length: primerDiaSemana }, () => null);
    const days = Array.from({ length: totalDias }, (_, i) => i + 1);
    return [...blanks, ...days];
  });

  // Paginación
  paginaActual = signal<number>(1);
  itemsPorPagina = signal<number>(5);

  facturasFiltradas = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.facturas();

    return this.facturas().filter(f => {
      const numFac = String(f.id_factura || '');
      const facProText = `facpro${numFac.padStart(5, '0')}`.toLowerCase();
      const facSimpleText = `fac-${numFac}`.toLowerCase();
      const pedidoText = `pedido #${f.id_pedido}`.toLowerCase();
      const numPedido = String(f.id_pedido || '');
      const mesaText = `mesa ${f.numero_mesa}`.toLowerCase();
      const numMesa = String(f.numero_mesa || '');
      const clienteText = (f.cliente || '').toLowerCase();
      const nitText = (f.cliente_nit || '').toLowerCase();
      const meseroText = (f.mesero || '').toLowerCase();
      const cajeroText = (f.cajero || '').toLowerCase();
      const metodoText = (f.metodo_pago || '').toLowerCase();

      return (
        facProText.includes(q) ||
        facSimpleText.includes(q) ||
        numFac === q ||
        pedidoText.includes(q) ||
        numPedido === q ||
        mesaText.includes(q) ||
        numMesa === q ||
        clienteText.includes(q) ||
        nitText.includes(q) ||
        meseroText.includes(q) ||
        cajeroText.includes(q) ||
        metodoText.includes(q)
      );
    });
  });

  totalPaginas = computed(() => {
    const total = Math.ceil(this.facturasFiltradas().length / this.itemsPorPagina());
    return total > 0 ? total : 1;
  });

  facturasPaginadas = computed(() => {
    const start = (this.paginaActual() - 1) * this.itemsPorPagina();
    return this.facturasFiltradas().slice(start, start + this.itemsPorPagina());
  });

  paginasArray = computed(() => {
    const total = this.totalPaginas();
    const actual = this.paginaActual();
    const pages: number[] = [];

    let start = Math.max(1, actual - 2);
    let end = Math.min(total, start + 4);
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  ngOnInit() {
    this.load();
    this.cargarFacturasPorFecha();
  }

  load() {
    this.loading.set(true);
    this.svc.getVentas().subscribe({
      next: (v: any) => {
        const list: VentaReporte[] = Array.isArray(v) ? v : (v?.data || []);
        this.ventas.set(list);
        const total = list.reduce((s, x) => s + +x.total_ventas, 0);
        this.totalGeneral.set(total);
        this.avgDiario.set(list.length ? total / list.length : 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });

    this.svc.getProductosTop().subscribe({
      next: (p: any) => {
        const list = Array.isArray(p) ? p : [];
        this.productosTop.set(list);
      },
      error: () => {}
    });
  }

  cargarFacturasPorFecha() {
    const y = this.selectedYear();
    const m = this.selectedMonth() + 1; // 1-12
    const d = this.selectedDay();

    let fechaInicio: string;
    let fechaFin: string;

    if (d !== null) {
      const fechaStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      fechaInicio = fechaStr;
      fechaFin = fechaStr;
    } else {
      const lastDay = new Date(y, m, 0).getDate();
      fechaInicio = `${y}-${String(m).padStart(2, '0')}-01`;
      fechaFin = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    this.cajaSvc.getFacturas({ fechaInicio, fechaFin, search: this.busqueda() }).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        this.facturas.set(list);
      },
      error: (err) => console.error('Error al cargar facturas en reportes:', err)
    });
  }

  toggleCalendar(event?: Event) {
    if (event) event.stopPropagation();
    this.showCalendar.update(v => !v);
  }

  prevYear(event?: Event) {
    if (event) event.stopPropagation();
    this.selectedYear.update(y => y - 1);
    if (this.calendarMode() === 'mes' && this.selectedDay() === null) {
      this.cargarFacturasPorFecha();
    }
  }

  nextYear(event?: Event) {
    if (event) event.stopPropagation();
    this.selectedYear.update(y => y + 1);
    if (this.calendarMode() === 'mes' && this.selectedDay() === null) {
      this.cargarFacturasPorFecha();
    }
  }

  prevMonth(event?: Event) {
    if (event) event.stopPropagation();
    if (this.selectedMonth() === 0) {
      this.selectedMonth.set(11);
      this.selectedYear.update(y => y - 1);
    } else {
      this.selectedMonth.update(m => m - 1);
    }
    if (this.calendarMode() === 'mes') {
      this.cargarFacturasPorFecha();
    }
  }

  nextMonth(event?: Event) {
    if (event) event.stopPropagation();
    if (this.selectedMonth() === 11) {
      this.selectedMonth.set(0);
      this.selectedYear.update(y => y + 1);
    } else {
      this.selectedMonth.update(m => m + 1);
    }
    if (this.calendarMode() === 'mes') {
      this.cargarFacturasPorFecha();
    }
  }

  setCalendarMode(mode: 'mes' | 'dia', event?: Event) {
    if (event) event.stopPropagation();
    this.calendarMode.set(mode);
  }

  selectMonth(m: number, event?: Event) {
    if (event) event.stopPropagation();
    this.selectedMonth.set(m);
    this.selectedDay.set(null);
    this.paginaActual.set(1);
    this.cargarFacturasPorFecha();
    this.showCalendar.set(false);
  }

  selectDay(d: number, event?: Event) {
    if (event) event.stopPropagation();
    this.selectedDay.set(d);
    this.paginaActual.set(1);
    this.cargarFacturasPorFecha();
    this.showCalendar.set(false);
  }

  selectTodoElMes(event?: Event) {
    if (event) event.stopPropagation();
    this.selectedDay.set(null);
    this.paginaActual.set(1);
    this.cargarFacturasPorFecha();
    this.showCalendar.set(false);
  }

  closeCalendar() {
    this.showCalendar.set(false);
  }

  onSearchChange(text: string) {
    this.busqueda.set(text);
    this.paginaActual.set(1);
  }

  irAPagina(p: number) {
    if (p >= 1 && p <= this.totalPaginas()) {
      this.paginaActual.set(p);
    }
  }

  paginaSiguiente() {
    if (this.paginaActual() < this.totalPaginas()) {
      this.paginaActual.update(p => p + 1);
    }
  }

  paginaAnterior() {
    if (this.paginaActual() > 1) {
      this.paginaActual.update(p => p - 1);
    }
  }

  descargarPDF(idFactura: number, event?: Event) {
    if (event) event.stopPropagation();
    this.downloadingPdfId.set(idFactura);

    this.cajaSvc.descargarFacturaPDF(idFactura).subscribe({
      next: blob => {
        this.downloadingPdfId.set(null);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const facProName = this.formatFacturaNumero(idFactura);
        a.download = `Factura_PedidoPro_${facProName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.alert.successToast(`Factura ${facProName} descargada en PDF`);
      },
      error: () => {
        this.downloadingPdfId.set(null);
        this.alert.error('Error al descargar PDF', 'No se pudo generar el archivo PDF.');
      }
    });
  }

  verDetalleFactura(idFactura: number, event?: Event) {
    if (event) event.stopPropagation();
    this.loadingFacturaDetalle.set(true);
    this.showFacturaModal.set(true);
    this.selectedFacturaDetalle.set(null);

    this.cajaSvc.getFacturaById(idFactura).subscribe({
      next: (fac) => {
        this.selectedFacturaDetalle.set(fac);
        this.loadingFacturaDetalle.set(false);
      },
      error: (err) => {
        console.error('Error al cargar detalle de factura:', err);
        this.loadingFacturaDetalle.set(false);
        this.showFacturaModal.set(false);
        this.alert.error('Error', 'No se pudo obtener el detalle de la factura.');
      }
    });
  }

  cerrarDetalleFactura() {
    this.showFacturaModal.set(false);
    this.selectedFacturaDetalle.set(null);
  }

  formatFacturaNumero(id: number): string {
    return `FACPRO${String(id).padStart(5, '0')}`;
  }

  formatearFechaHoraSimple(fecha?: string): string {
    if (!fecha) return '-';
    const d = new Date(fecha);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dia}/${mes}/${anio}, ${hora}`;
  }

  getBarH(val: number): string {
    const max = Math.max(...this.ventas().map(v => +v.total_ventas), 1);
    return ((+val / max) * 140) + 'px';
  }

  getTopW(val: number): string {
    const max = Math.max(...this.productosTop().map(p => +p.total_vendido), 1);
    return ((+val / max) * 100) + '%';
  }

  formatCurrency(n: number) {
    return 'Q ' + (+n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}


