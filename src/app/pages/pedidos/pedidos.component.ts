import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService } from '../../core/services/menu.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { MesasService } from '../../core/services/mesas.service';
import { ClientesService } from '../../core/services/clientes.service';
import { AlertService } from '../../core/services/alert.service';
import { Producto, Categoria, DetallePedido, Mesa, Cliente } from '../../core/models';

const DEFAULT_CATEGORIAS: Categoria[] = [
  { id_categoria: 4, nombre_categoria: 'Entradas' },
  { id_categoria: 2, nombre_categoria: 'Bebidas' },
  { id_categoria: 1, nombre_categoria: 'Platos Fuertes' },
  { id_categoria: 3, nombre_categoria: 'Postres' }
];

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './pedidos.component.html',
  styleUrl: './pedidos.component.scss'
})
export class PedidosComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private menuSvc = inject(MenuService);
  private pedidosSvc = inject(PedidosService);
  private mesasSvc = inject(MesasService);
  private clientesSvc = inject(ClientesService);
  private alert = inject(AlertService);

  mesaId  = signal(0);
  mesaNum = signal(0);
  clienteId = signal<number | undefined>(undefined);
  mesas   = signal<Mesa[]>([]);
  clientes = signal<Cliente[]>([]);
  productos = signal<Producto[]>([]);
  categorias = signal<Categoria[]>(DEFAULT_CATEGORIAS);
  carrito   = signal<DetallePedido[]>([]);
  catActiva = signal(0);
  notas     = signal('');
  loading   = signal(true);
  sending   = signal(false);

  filtrados = computed(() => {
    const p = this.productos();
    const catId = Number(this.catActiva());
    if (!catId) return p.filter(x => x.disponible);

    const catObj = this.categorias().find(c => Number(c.id_categoria) === catId);
    const catName = catObj?.nombre_categoria?.toLowerCase().trim();

    return p.filter(x => {
      if (!x.disponible) return false;
      const pCatId = Number(x.id_categoria);
      if (pCatId && pCatId === catId) return true;
      if (x.nombre_categoria && catName && x.nombre_categoria.toLowerCase().trim() === catName) return true;
      return false;
    });
  });

  total = () => this.carrito().reduce((s, d) => s + ((d.precio_unitario_historico ?? 0) * d.cantidad), 0);
  cantTotal = () => this.carrito().reduce((s, d) => s + d.cantidad, 0);

  ngOnInit() {
    this.mesasSvc.getMesas().subscribe({
      next: (m: Mesa[]) => {
        this.mesas.set(m);
        // Si no se pasó mesa por query param, preseleccionar la primera mesa libre si existe
        if (!this.mesaId() && m.length > 0) {
          const libre = m.find(x => x.estado === 'Libre') || m[0];
          if (libre) {
            this.mesaId.set(libre.id_mesa);
            this.mesaNum.set(libre.numero_mesa);
          }
        }
      }
    });

    this.route.queryParams.subscribe(p => {
      const qMesa = +p['mesa'] || 0;
      const qNum = +p['num'] || 0;
      if (qMesa) {
        this.mesaId.set(qMesa);
        this.mesaNum.set(qNum);
      }
    });

    this.menuSvc.getMenu().subscribe({
      next: p => {
        this.productos.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.clientesSvc.getClientes().subscribe({
      next: c => this.clientes.set(c || []),
      error: () => this.clientes.set([])
    });

    this.menuSvc.getCategorias().subscribe({
      next: c => {
        if (c && c.length > 0) {
          this.categorias.set(c);
        } else {
          this.categorias.set(DEFAULT_CATEGORIAS);
        }
      },
      error: () => this.categorias.set(DEFAULT_CATEGORIAS)
    });
  }

  onSelectMesa(id: any) {
    const mId = Number(id);
    this.mesaId.set(mId);
    const found = this.mesas().find(m => m.id_mesa === mId);
    this.mesaNum.set(found ? found.numero_mesa : 0);
  }

  agregar(p: Producto) {
    const items = this.carrito();
    const idx = items.findIndex(i => i.id_producto === p.id_producto);
    if (idx >= 0) {
      const updated = [...items];
      updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 };
      this.carrito.set(updated);
    } else {
      this.carrito.update(c => [...c, {
        id_producto: p.id_producto,
        cantidad: 1,
        precio_unitario_historico: p.precio,
        notas_especiales: '',
        nombre_producto: p.nombre_producto
      }]);
    }
  }

  agregarById(id: number) {
    const p = this.productos().find(x => x.id_producto === id);
    if (p) this.agregar(p);
  }

  quitar(id: number) {
    const items = this.carrito();
    const idx = items.findIndex(i => i.id_producto === id);
    if (idx < 0) return;
    const updated = [...items];
    if (updated[idx].cantidad > 1) {
      updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad - 1 };
      this.carrito.set(updated);
    } else {
      this.carrito.update(c => c.filter(i => i.id_producto !== id));
    }
  }

  getQty(id: number) {
    return this.carrito().find(i => i.id_producto === id)?.cantidad ?? 0;
  }

  showClienteModal = signal(false);
  nuevoCliente = signal<Partial<Cliente>>({ nombre_completo: '', nit_documento: '', telefono: '', correo_electronico: '' });
  guardandoCliente = signal(false);

  abrirModalCliente() {
    this.nuevoCliente.set({ nombre_completo: '', nit_documento: '', telefono: '', correo_electronico: '' });
    this.showClienteModal.set(true);
  }

  cerrarModalCliente() {
    this.showClienteModal.set(false);
  }

  updateNuevoCliente(field: string, val: string) {
    this.nuevoCliente.update(c => ({ ...c, [field]: val }));
  }

  guardarNuevoCliente() {
    const c = this.nuevoCliente();
    if (!c.nombre_completo || !c.nombre_completo.trim()) {
      this.alert.warningToast('El nombre completo del cliente es obligatorio');
      return;
    }

    this.guardandoCliente.set(true);
    this.clientesSvc.createCliente(c).subscribe({
      next: (created: any) => {
        const newId = created.id_cliente || (created.data ? created.data.id_cliente : undefined) || created.id;
        const clientObj: Cliente = {
          id_cliente: newId || Date.now(),
          nombre_completo: c.nombre_completo!.trim(),
          nit_documento: c.nit_documento?.trim() || '',
          telefono: c.telefono?.trim() || '',
          correo_electronico: c.correo_electronico?.trim() || ''
        };

        this.clientes.update(list => [clientObj, ...list]);
        this.clienteId.set(clientObj.id_cliente);
        this.alert.success('Cliente Registrado', `Cliente "${clientObj.nombre_completo}" registrado y asignado al pedido.`);
        this.guardandoCliente.set(false);
        this.showClienteModal.set(false);
      },
      error: e => {
        this.alert.error('Error al registrar cliente', e.error?.message || 'No se pudo crear el cliente');
        this.guardandoCliente.set(false);
      }
    });
  }

  enviar() {
    if (!this.mesaId()) {
      this.alert.warningToast('Por favor selecciona una mesa para la orden');
      return;
    }
    if (!this.carrito().length) {
      this.alert.warningToast('Agrega al menos un producto al pedido');
      return;
    }

    this.sending.set(true);
    this.pedidosSvc.createPedido({
      id_mesa: this.mesaId(),
      id_cliente: this.clienteId() || undefined,
      notas_generales: this.notas(),
      detalles: this.carrito().map(d => ({
        id_producto: d.id_producto,
        cantidad: d.cantidad,
        notas_especiales: d.notas_especiales
      }))
    }).subscribe({
      next: () => {
        this.alert.success('Pedido Enviado', `La orden para la Mesa ${this.mesaNum() || this.mesaId()} fue enviada a Cocina.`);
        this.carrito.set([]);
        this.notas.set('');
        this.clienteId.set(undefined);
        this.sending.set(false);
        setTimeout(() => this.router.navigate(['/mesas']), 400);
      },
      error: e => {
        this.alert.error('Error al enviar pedido', e.error?.message || 'No se pudo registrar el pedido');
        this.sending.set(false);
      }
    });
  }

  getCatIcon(catId: number): string {
    const cat = this.categorias().find(c => Number(c.id_categoria) === Number(catId))?.nombre_categoria ?? '';
    const name = cat.toLowerCase();
    if (name.includes('entrada')) return 'pi pi-tag';
    if (name.includes('bebida')) return 'pi pi-glass';
    if (name.includes('fuerte') || name.includes('plato')) return 'pi pi-box';
    if (name.includes('postre')) return 'pi pi-sparkles';
    return 'pi pi-book';
  }

  formatCurrency(n: number) {
    return 'Q ' + (+n).toFixed(2);
  }
}
