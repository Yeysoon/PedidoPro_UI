import { Component, signal, computed, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CajaService, FacturaHistorial } from '../../core/services/caja.service';
import { ClientesService } from '../../core/services/clientes.service';
import { AlertService } from '../../core/services/alert.service';
import { Pedido, Cliente, FacturarRequest } from '../../core/models';

const METODOS = [
  { id: 1, nombre_metodo: 'Efectivo', icon: 'pi pi-money-bill' },
  { id: 2, nombre_metodo: 'Tarjeta de Crédito / Débito', icon: 'pi pi-credit-card' },
  { id: 3, nombre_metodo: 'Transferencia Bancaria', icon: 'pi pi-building-columns' }
];

// Componente del Punto de Caja y Cobro
@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './caja.component.html',
  styleUrl: './caja.component.scss'
})
export class CajaComponent implements OnInit, OnDestroy {
  Math = Math;
  private cajaSvc = inject(CajaService);
  private clientesSvc = inject(ClientesService);
  private alert = inject(AlertService);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.calendar-filter-wrapper')) {
      this.showCalendar.set(false);
    }
  }

  pedidos  = signal<Pedido[]>([]);
  clientes = signal<Cliente[]>([]);
  metodos  = signal(METODOS);
  loading  = signal(true);
  busqueda = signal('');
  selected = signal<Pedido | null>(null);
  showModal = signal(false);
  factura   = signal<FacturarRequest>({ id_pedido: 0, id_metodo_pago: 1, propina: 0 });
  sending   = signal(false);

  // Nueva sección: Historial de pedidos cobrados
  facturas = signal<FacturaHistorial[]>([]);
  downloadingPdfId = signal<number | null>(null);

  // Modal Resumen / Detalle de Factura
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

  private interval: any;

  pedidosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.pedidos();

    return this.pedidos().filter(p => {
      const numPedido = String(p.id_pedido || '');
      const numMesa = String(p.numero_mesa || '');
      const mesaText = `mesa ${p.numero_mesa}`.toLowerCase();
      const meseroText = (p.mesero || '').toLowerCase();
      const clienteText = (p.cliente_nombre || '').toLowerCase();
      const nitText = (p.cliente_nit || '').toLowerCase();

      return (
        numPedido.includes(q) ||
        numMesa === q ||
        mesaText.includes(q) ||
        meseroText.includes(q) ||
        clienteText.includes(q) ||
        nitText.includes(q)
      );
    });
  });

  ngOnInit() {
    this.load(true);
    this.interval = setInterval(() => this.load(false), 5000);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  load(showLoading = true) {
    if (showLoading && !this.pedidos().length) {
      this.loading.set(true);
    }
    this.cajaSvc.getPedidosListos().subscribe({
      next: p => {
        this.pedidos.set(p || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.cargarFacturasPorFecha();

    this.clientesSvc.getClientes().subscribe({
      next: c => this.clientes.set(c || [])
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
      error: (err) => console.error('Error al cargar facturas por fecha:', err)
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

  cambiarItemsPorPagina(n: number) {
    this.itemsPorPagina.set(+n);
    this.paginaActual.set(1);
  }

  seleccionar(p: Pedido) {
    this.selected.set(p);
    this.factura.set({
      id_pedido: p.id_pedido,
      id_metodo_pago: 1,
      propina: 0,
      id_cliente: p.id_cliente ? Number(p.id_cliente) : undefined
    });
    this.showModal.set(true);
  }

  facturar() {
    if (!this.selected()) return;
    this.sending.set(true);
    const mesaNum = this.selected()?.numero_mesa;
    this.cajaSvc.facturar(this.factura()).subscribe({
      next: (res) => {
        this.alert.success('Factura Generada', `Se cobró exitosamente el pedido de la Mesa ${mesaNum}.`);
        this.showModal.set(false);
        this.sending.set(false);
        this.load(false);

        // Auto-generar y descargar PDF de la factura emitida
        if (res?.id_factura) {
          this.descargarPDF(res.id_factura);
        }
      },
      error: e => {
        this.alert.error('Error al facturar', e.error?.message || 'No se pudo procesar el cobro');
        this.sending.set(false);
      }
    });
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

  getTotal(p: Pedido): number {
    if (p.detalles && p.detalles.length > 0) {
      return p.detalles.reduce((s, d) => s + (Number(d.precio_unitario_historico || 0) * (d.cantidad || 1)), 0);
    }
    return Number(p.total_estimado || 0);
  }

  formatCurrency(n: number): string {
    return 'Q ' + (+n || 0).toFixed(2);
  }

  updateFact(field: string, val: any) {
    this.factura.update(f => ({ ...f, [field]: val }));
  }

  getInitials(name?: string): string {
    if (!name) return 'ME';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  tiempoTranscurrido(fecha?: string): string {
    if (!fecha) return '0 min';
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Ahora';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
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

  formatearFechaHora(fecha?: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
    const diaNom = dias[d.getDay()];
    const diaNum = String(d.getDate()).padStart(2, '0');
    const mesNom = meses[d.getMonth()];
    const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${diaNom}, ${diaNum} ${mesNom} · ${hora}`;
  }
}

