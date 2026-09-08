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

  // Modo edición de pedido
  isEditing = signal(false);
  editPedidoId = signal<number | null>(null);

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
        if (!this.mesaId() && !this.isEditing() && m.length > 0) {
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
      const editId = +p['edit'] || 0;

      if (editId) {
        this.isEditing.set(true);
        this.editPedidoId.set(editId);
        this.cargarPedidoParaEdicion(editId);
      } else if (qMesa) {
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

  cargarPedidoParaEdicion(id_pedido: number) {
    this.pedidosSvc.getPedido(id_pedido).subscribe({
      next: (pedido: any) => {
        if (!pedido) return;
        if (pedido.id_mesa) {
          this.mesaId.set(Number(pedido.id_mesa));
          this.mesaNum.set(Number(pedido.numero_mesa || 0));
        }
        if (pedido.id_cliente) {
          this.clienteId.set(Number(pedido.id_cliente));
        }
        if (pedido.notas_generales) {
          this.notas.set(pedido.notas_generales);
        }
        if (pedido.detalles && pedido.detalles.length) {
          this.carrito.set(pedido.detalles.map((d: any) => ({
            id_detalle: d.id_detalle,
            id_producto: d.id_producto,
            cantidad: Number(d.cantidad),
            precio_unitario_historico: Number(d.precio_unitario_historico ?? d.precio ?? 0),
            notas_especiales: d.notas_especiales || '',
            nombre_producto: d.nombre_producto
          })));
        }
      },
      error: () => {
        this.alert.error('Error', 'No se pudo cargar el pedido a editar');
        this.isEditing.set(false);
        this.editPedidoId.set(null);
      }
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
  nuevoCliente = signal<{ nombre_completo: string; nit_documento: string }>({ nombre_completo: '', nit_documento: '' });
  guardandoCliente = signal(false);

  abrirModalCliente() {
    this.nuevoCliente.set({ nombre_completo: '', nit_documento: '' });
    this.showClienteModal.set(true);
  }

  cerrarModalCliente() {
    this.showClienteModal.set(false);
  }

  onInputNombre(inputEl: HTMLInputElement) {
    // Solo permitir letras del abecedario, tildes, ñ y espacios, máximo 60 caracteres
    const raw = inputEl.value || '';
    const filtered = raw.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '').slice(0, 60);
    if (inputEl.value !== filtered) {
      inputEl.value = filtered;
    }
    this.nuevoCliente.update(c => ({ ...c, nombre_completo: filtered }));
  }

  onInputNit(inputEl: HTMLInputElement) {
    // Solo permitir números dígitos (0-9), máximo 13 dígitos
    const raw = inputEl.value || '';
    const filtered = raw.replace(/\D/g, '').slice(0, 13);
    if (inputEl.value !== filtered) {
      inputEl.value = filtered;
    }
    this.nuevoCliente.update(c => ({ ...c, nit_documento: filtered }));
  }

  guardarNuevoCliente() {
    const c = this.nuevoCliente();
    const nombre = (c.nombre_completo || '').trim();
    const nit = (c.nit_documento || '').trim();

    if (!nombre) {
      this.alert.warningToast('El nombre completo del cliente es obligatorio');
      return;
    }

    if (nombre.length < 3) {
      this.alert.warningToast('El nombre debe tener al menos 3 caracteres');
      return;
    }

    if (nombre.length > 60) {
      this.alert.warningToast('El nombre no puede exceder 60 caracteres');
      return;
    }

    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!nameRegex.test(nombre)) {
      this.alert.warningToast('El nombre solo debe contener letras y espacios');
      return;
    }

    if (nit) {
      if (!/^\d+$/.test(nit)) {
        this.alert.warningToast('El NIT solo debe contener dígitos numéricos');
        return;
      }
      if (nit.length < 7 || nit.length > 13) {
        this.alert.warningToast('El NIT debe tener entre 7 y 13 dígitos');
        return;
      }
    }

    this.guardandoCliente.set(true);
    this.clientesSvc.createCliente({
      nombre_completo: nombre,
      nit_documento: nit
    }).subscribe({
      next: (created: any) => {
        const newId = created.id_cliente || (created.data ? created.data.id_cliente : undefined) || created.id;
        const clientObj: Cliente = {
          id_cliente: newId || Date.now(),
          nombre_completo: nombre,
          nit_documento: nit || undefined
        };

        this.clientes.update(list => {
          const filtered = list.filter(x => x.id_cliente !== clientObj.id_cliente);
          return [clientObj, ...filtered];
        });
        this.clienteId.set(clientObj.id_cliente);
        this.alert.success('Cliente Registrado', created.message || `Cliente "${clientObj.nombre_completo}" registrado y asignado al pedido.`);
        this.guardandoCliente.set(false);
        this.showClienteModal.set(false);
      },
      error: e => {
        this.alert.error('Error al registrar cliente', e.error?.message || 'No se pudo crear el cliente');
        this.guardandoCliente.set(false);
      }
    });
  }

  cancelarEdicion() {
    this.router.navigate(['/cocina']);
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

    if (this.isEditing() && this.editPedidoId()) {
      this.pedidosSvc.updatePedido(this.editPedidoId()!, {
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
          this.alert.success('Pedido Actualizado', `El pedido #${this.editPedidoId()} fue actualizado exitosamente.`);
          this.carrito.set([]);
          this.notas.set('');
          this.clienteId.set(undefined);
          this.isEditing.set(false);
          this.editPedidoId.set(null);
          this.sending.set(false);
          setTimeout(() => this.router.navigate(['/cocina']), 400);
        },
        error: e => {
          this.alert.error('Error al actualizar pedido', e.error?.message || 'No se pudo actualizar el pedido');
          this.sending.set(false);
        }
      });
      return;
    }

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
