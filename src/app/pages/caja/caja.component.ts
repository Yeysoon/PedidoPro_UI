import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CajaService } from '../../core/services/caja.service';
import { ClientesService } from '../../core/services/clientes.service';
import { AlertService } from '../../core/services/alert.service';
import { Pedido, Cliente, FacturarRequest } from '../../core/models';

const METODOS = [
  { id: 1, nombre_metodo: 'Efectivo', icon: 'pi pi-money-bill' },
  { id: 2, nombre_metodo: 'Tarjeta de Crédito / Débito', icon: 'pi pi-credit-card' },
  { id: 3, nombre_metodo: 'Transferencia Bancaria', icon: 'pi pi-building-columns' }
];

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './caja.component.html',
  styleUrl: './caja.component.scss'
})
export class CajaComponent implements OnInit, OnDestroy {
  private cajaSvc = inject(CajaService);
  private clientesSvc = inject(ClientesService);
  private alert = inject(AlertService);

  pedidos  = signal<Pedido[]>([]);
  clientes = signal<Cliente[]>([]);
  metodos  = signal(METODOS);
  loading  = signal(true);
  busqueda = signal('');
  selected = signal<Pedido | null>(null);
  showModal = signal(false);
  factura   = signal<FacturarRequest>({ id_pedido: 0, id_metodo_pago: 1, propina: 0 });
  sending   = signal(false);
  private interval: any;

  pedidosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.pedidos();

    return this.pedidos().filter(p => {
      const mesaText = `mesa ${p.numero_mesa}`.toLowerCase();
      const comandaText = `comanda #${p.id_pedido}`.toLowerCase();
      const tituloCombinado = `mesa ${p.numero_mesa} | comanda #${p.id_pedido}`.toLowerCase();
      const numMesa = String(p.numero_mesa || '');
      const numPedido = String(p.id_pedido || '');

      if (
        mesaText.includes(q) ||
        comandaText.includes(q) ||
        tituloCombinado.includes(q) ||
        numMesa === q ||
        numPedido === q
      ) {
        return true;
      }

      if (p.mesero?.toLowerCase().includes(q)) return true;
      if (p.detalles?.some(d => d.nombre_producto?.toLowerCase().includes(q))) return true;

      return false;
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
    this.clientesSvc.getClientes().subscribe({
      next: c => this.clientes.set(c || [])
    });
  }

  seleccionar(p: Pedido) {
    this.selected.set(p);
    this.factura.set({ id_pedido: p.id_pedido, id_metodo_pago: 1, propina: 0 });
    this.showModal.set(true);
  }

  facturar() {
    if (!this.selected()) return;
    this.sending.set(true);
    this.cajaSvc.facturar(this.factura()).subscribe({
      next: () => {
        this.alert.success('Factura Generada', `Se cobró exitosamente la comanda de la Mesa ${this.selected()?.numero_mesa}.`);
        this.showModal.set(false);
        this.sending.set(false);
        this.load(false);
      },
      error: e => {
        this.alert.error('Error al facturar', e.error?.message || 'No se pudo procesar el cobro');
        this.sending.set(false);
      }
    });
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
