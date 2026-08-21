import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CajaService } from '../../core/services/caja.service';
import { ClientesService } from '../../core/services/clientes.service';
import { AlertService } from '../../core/services/alert.service';
import { Pedido, Cliente, FacturarRequest } from '../../core/models';

const METODOS = [
  { id: 1, nombre_metodo: 'Efectivo', icon: 'payments' },
  { id: 2, nombre_metodo: 'Tarjeta de Crédito/Débito', icon: 'credit_card' },
  { id: 3, nombre_metodo: 'Transferencia Bancaria', icon: 'account_balance' }
];

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './caja.component.html',
  styleUrl: './caja.component.scss'
})
export class CajaComponent implements OnInit {
  pedidos  = signal<Pedido[]>([]);
  clientes = signal<Cliente[]>([]);
  metodos  = signal(METODOS);
  loading  = signal(true);
  selected = signal<Pedido | null>(null);
  showModal = signal(false);
  factura   = signal<FacturarRequest>({ id_pedido: 0, id_metodo_pago: 1, propina: 0 });
  sending   = signal(false);

  constructor(
    private cajaSvc: CajaService,
    private clientesSvc: ClientesService,
    private alert: AlertService
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.cajaSvc.getPedidosListos().subscribe({
      next: p => { this.pedidos.set(p); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.clientesSvc.getClientes().subscribe({ next: c => this.clientes.set(c) });
  }

  seleccionar(p: Pedido) {
    this.selected.set(p);
    this.factura.set({ id_pedido: p.id_pedido, id_metodo_pago: 1, propina: 0 });
    this.showModal.set(true);
  }

  facturar() {
    this.sending.set(true);
    this.cajaSvc.facturar(this.factura()).subscribe({
      next: () => {
        this.alert.success('Factura Generada', `Se cobró exitosamente la comanda de la Mesa ${this.selected()?.numero_mesa}.`);
        this.showModal.set(false);
        this.sending.set(false);
        this.load();
      },
      error: e => {
        this.alert.error('Error al facturar', e.error?.message);
        this.sending.set(false);
      }
    });
  }

  getTotal(p: Pedido) {
    return p.detalles?.reduce((s, d) => s + (d.precio_unitario_historico ?? 0) * d.cantidad, 0) ?? 0;
  }

  formatCurrency(n: number) {
    return 'Q ' + (+n).toFixed(2);
  }

  updateFact(field: string, val: any) {
    this.factura.update(f => ({ ...f, [field]: val }));
  }
}
