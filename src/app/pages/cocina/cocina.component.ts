import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CocinaService } from '../../core/services/cocina.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { InventarioService } from '../../core/services/inventario.service';
import { MenuService } from '../../core/services/menu.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { Comanda, Ingrediente, Producto } from '../../core/models';

export interface CheckIngredienteItem {
  id_ingrediente: number;
  nombre_ingrediente: string;
  unidad_medida: string;
  cantidad_requerida: number;
  stock_actual: number;
  tiene_stock: boolean;
  checked: boolean;
}

export interface DetallePreparacionItem {
  id_detalle?: number;
  id_producto?: number;
  nombre_producto: string;
  cantidad: number;
  notas_especiales?: string;
  ingredientes: CheckIngredienteItem[];
  sin_receta: boolean;
  checked_item: boolean;
}

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './cocina.component.html',
  styleUrl: './cocina.component.scss'
})
export class CocinaComponent implements OnInit, OnDestroy {
  private svc = inject(CocinaService);
  private pedidosSvc = inject(PedidosService);
  private inventarioSvc = inject(InventarioService);
  private menuSvc = inject(MenuService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);
  private router = inject(Router);

  comandas = signal<Comanda[]>([]);
  busqueda = signal('');
  loading  = signal(true);
  draggedComanda: Comanda | null = null;
  dragOverColId = signal<number | null>(null);
  private interval: any;

  // --- MODAL DE DETALLE & CONTROL DE PREPARACIÓN DE COMANDAS ---
  showModalDetalle      = signal(false);
  modalComanda          = signal<Comanda | null>(null);
  modalDetalles         = signal<DetallePreparacionItem[]>([]);
  loadingModalDetalle   = signal(false);
  ingredientesInventario = signal<Ingrediente[]>([]);

  totalIngredientesCount = computed(() => {
    let count = 0;
    for (const d of this.modalDetalles()) {
      if (d.ingredientes.length > 0) {
        count += d.ingredientes.length;
      } else {
        count += 1;
      }
    }
    return count;
  });

  totalCheckedCount = computed(() => {
    let count = 0;
    for (const d of this.modalDetalles()) {
      if (d.ingredientes.length > 0) {
        count += d.ingredientes.filter(i => i.checked).length;
      } else if (d.checked_item) {
        count += 1;
      }
    }
    return count;
  });

  todosChecked = computed(() => {
    const details = this.modalDetalles();
    if (!details.length) return false;
    for (const d of details) {
      if (d.ingredientes.length > 0) {
        if (!d.ingredientes.every(i => i.checked)) return false;
      } else {
        if (!d.checked_item) return false;
      }
    }
    return true;
  });

  todosTienenStock = computed(() => {
    const details = this.modalDetalles();
    if (!details.length) return true;
    for (const d of details) {
      for (const i of d.ingredientes) {
        if (!i.tiene_stock) return false;
      }
    }
    return true;
  });

  editarPedido(c: Comanda, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/pedidos'], { queryParams: { edit: c.id_pedido } });
  }

  async cancelarPedido(c: Comanda, event: Event) {
    event.stopPropagation();
    const confirmed = await this.alert.confirm(
      '¿Cancelar pedido?',
      `¿Deseas cancelar el Pedido #${c.id_pedido} de la Mesa ${c.numero_mesa}? Se liberará la mesa y los platillos asociados.`,
      'Sí, cancelar pedido'
    );
    if (!confirmed) return;

    // Remover inmediatamente de la vista (borrado lógico a nivel UI)
    this.comandas.update(list => list.filter(item => item.id_pedido !== c.id_pedido));

    this.pedidosSvc.cancelPedido(c.id_pedido).subscribe({
      next: () => {
        this.alert.successToast(`Pedido #${c.id_pedido} cancelado`);
        this.load(false);
      },
      error: (err: any) => {
        this.alert.error('Error al cancelar', err.error?.message || 'No se pudo cancelar el pedido');
        this.load(false);
      }
    });
  }

  // --- ABRIR MODAL DE DETALLE (ADMIN Y COCINERO) ---
  async abrirDetalle(c: Comanda) {
    if (!this.isAdmin() && !this.isCocinero()) return;

    this.modalComanda.set(c);
    this.showModalDetalle.set(true);
    this.loadingModalDetalle.set(true);

    try {
      // 1. Obtener inventario actual y catálogo de productos en tiempo real
      const [ings, menuProds] = await Promise.all([
        firstValueFrom(this.inventarioSvc.getIngredientes()).catch(() => [] as Ingrediente[]),
        firstValueFrom(this.menuSvc.getMenu()).catch(() => [] as Producto[])
      ]);
      this.ingredientesInventario.set(ings || []);

      // 2. Obtener recetas de cada platillo del pedido
      const detallesItems: DetallePreparacionItem[] = [];

      for (const d of c.detalles || []) {
        let prodId = d.id_producto;
        if (!prodId && d.nombre_producto && Array.isArray(menuProds)) {
          const matchedProd = menuProds.find(
            p => p.nombre_producto?.trim().toLowerCase() === d.nombre_producto?.trim().toLowerCase()
          );
          if (matchedProd) {
            prodId = matchedProd.id_producto;
          }
        }

        let receta: any[] = [];
        if (prodId) {
          const rawReceta = await firstValueFrom(this.inventarioSvc.getReceta(prodId)).catch(() => []);
          receta = Array.isArray(rawReceta)
            ? rawReceta
            : (rawReceta && Array.isArray((rawReceta as any).data) ? (rawReceta as any).data : []);
        }

        const ingredientesChequeo: CheckIngredienteItem[] = [];
        if (receta && Array.isArray(receta) && receta.length > 0) {
          for (const r of receta) {
            const currentStockItem = (ings || []).find(i => Number(i.id_ingrediente) === Number(r.id_ingrediente));
            const stockActual = currentStockItem ? Number(currentStockItem.stock_actual) : 0;
            const cantidadRequerida = Number((Number(r.cantidad_necesaria || 1) * Number(d.cantidad || 1)).toFixed(2));
            const tieneStock = stockActual >= cantidadRequerida;

            ingredientesChequeo.push({
              id_ingrediente: Number(r.id_ingrediente),
              nombre_ingrediente: r.nombre_ingrediente || currentStockItem?.nombre_ingrediente || 'Ingrediente',
              unidad_medida: r.unidad_medida || currentStockItem?.unidad_medida || '',
              cantidad_requerida: cantidadRequerida,
              stock_actual: stockActual,
              tiene_stock: tieneStock,
              checked: Number(c.id_estado) >= 2 // Si ya está en preparación, listo o servido, inicializa tachado y consumido
            });
          }
        }

        detallesItems.push({
          id_detalle: d.id_detalle,
          id_producto: prodId,
          nombre_producto: d.nombre_producto || 'Platillo',
          cantidad: Number(d.cantidad || 1),
          notas_especiales: d.notas_especiales,
          ingredientes: ingredientesChequeo,
          sin_receta: ingredientesChequeo.length === 0,
          checked_item: Number(c.id_estado) >= 2
        });
      }

      this.modalDetalles.set(detallesItems);
      this.loadingModalDetalle.set(false);
    } catch (e) {
      console.error('Error al preparar detalle de comanda:', e);
      this.loadingModalDetalle.set(false);
    }
  }

  isChecklistEditable = computed(() => this.modalComanda()?.id_estado === 1);

  toggleIngredienteCheck(dishIdx: number, ingIdx: number) {
    if (!this.isChecklistEditable()) return;
    this.modalDetalles.update(list => {
      const copy = [...list];
      const dish = { ...copy[dishIdx] };
      const ings = [...dish.ingredientes];
      ings[ingIdx] = { ...ings[ingIdx], checked: !ings[ingIdx].checked };
      dish.ingredientes = ings;
      copy[dishIdx] = dish;
      return copy;
    });
  }

  toggleDishItemCheck(dishIdx: number) {
    if (!this.isChecklistEditable()) return;
    this.modalDetalles.update(list => {
      const copy = [...list];
      copy[dishIdx] = { ...copy[dishIdx], checked_item: !copy[dishIdx].checked_item };
      return copy;
    });
  }

  toggleCheckAll() {
    if (!this.isChecklistEditable()) return;
    const allChecked = this.todosChecked();
    this.modalDetalles.update(list =>
      list.map(dish => ({
        ...dish,
        checked_item: !allChecked,
        ingredientes: dish.ingredientes.map(ing => ({
          ...ing,
          checked: !allChecked
        }))
      }))
    );
  }

  isDishFullyChecked(d: DetallePreparacionItem): boolean {
    if (d.ingredientes.length > 0) {
      return d.ingredientes.every(i => i.checked);
    }
    return d.checked_item;
  }

  rebajarInventario() {
    const comanda = this.modalComanda();
    if (!comanda) return;

    if (!this.todosTienenStock()) {
      this.alert.error('Stock Insuficiente', 'No se puede rebajar el inventario porque hay insumos sin existencias en almacén.');
      return;
    }

    if (!this.todosChecked()) {
      this.alert.warningToast('Por favor marca todos los ingredientes de la comanda antes de rebajar.');
      return;
    }

    this.showModalDetalle.set(false);

    this.svc.updateEstado(comanda.id_pedido, 2).subscribe({
      next: () => {
        this.alert.successToast(`Inventario rebajado exitosamente. Pedido #${comanda.id_pedido} en preparación.`);
        this.load(false);
      },
      error: e => {
        this.alert.error('Error al rebajar inventario', e.error?.message || 'No se pudo actualizar el pedido');
        this.load(false);
      }
    });
  }

  avanzarEstadoModal(nuevoEstadoId: number) {
    const comanda = this.modalComanda();
    if (!comanda) return;

    if (!this.todosTienenStock()) {
      this.alert.error('Stock Insuficiente', 'No se puede avanzar el pedido porque faltan ingredientes en el inventario.');
      return;
    }

    this.cambiarEstado(comanda, nuevoEstadoId);
    this.showModalDetalle.set(false);
  }

  getEstadoNombre(id: number): string {
    const map: Record<number, string> = {
      1: 'Pendiente por iniciar',
      2: 'Preparándose en cocina',
      3: 'Listo para servir',
      4: 'Servido en Mesa'
    };
    return map[id] || 'Comanda';
  }

  getEstadoBadgeClass(id: number): string {
    const map: Record<number, string> = {
      1: 'warning',
      2: 'info',
      3: 'success',
      4: 'indigo'
    };
    return map[id] || 'neutral';
  }

  // Roles
  userRole = computed(() => this.auth.getRole() || 'Administrador');
  isCocinero = computed(() => this.userRole() === 'Cocinero');
  isMesero = computed(() => this.userRole() === 'Mesero');
  isAdmin = computed(() => this.userRole() === 'Administrador');

  // Filtro reactivo por búsqueda (ej: "Mesa 2 | Comanda #1", "Mesa 2", "#1", platillo, etc.)
  comandasFiltradas = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.comandas();

    return this.comandas().filter(c => {
      const mesaText = `mesa ${c.numero_mesa}`.toLowerCase();
      const pedidoText = `pedido #${c.id_pedido}`.toLowerCase();
      const comandaText = `comanda #${c.id_pedido}`.toLowerCase();
      const tituloCombinado = `mesa ${c.numero_mesa} | pedido #${c.id_pedido}`.toLowerCase();
      const tituloCombinadoComanda = `mesa ${c.numero_mesa} | comanda #${c.id_pedido}`.toLowerCase();
      const numMesa = String(c.numero_mesa || '');
      const numPedido = String(c.id_pedido || '');
      const hashPedido = `#${c.id_pedido}`;

      if (
        mesaText.includes(q) ||
        pedidoText.includes(q) ||
        comandaText.includes(q) ||
        tituloCombinado.includes(q) ||
        tituloCombinadoComanda.includes(q) ||
        numMesa === q ||
        numPedido === q ||
        hashPedido.includes(q)
      ) {
        return true;
      }

      if (c.mesero?.toLowerCase().includes(q)) return true;
      if (c.cliente_nombre?.toLowerCase().includes(q)) return true;
      if (c.detalles?.some(d => d.nombre_producto?.toLowerCase().includes(q))) return true;

      return false;
    });
  });

  // 1. Pendientes por iniciar (id_estado = 1)
  pendientesList = computed(() =>
    this.comandasFiltradas().filter(c => Number(c.id_estado) === 1 || (c.nombre_estado && c.nombre_estado.toLowerCase().includes('pendiente')) || (c.estado && c.estado.toLowerCase().includes('pendiente')))
  );

  // 2. Preparándose (id_estado = 2)
  preparandoList = computed(() =>
    this.comandasFiltradas().filter(c => Number(c.id_estado) === 2 || (c.nombre_estado && c.nombre_estado.toLowerCase().includes('prepar')) || (c.estado && c.estado.toLowerCase().includes('prepar')))
  );

  // 3. Listo para servir (id_estado = 3)
  listosList = computed(() =>
    this.comandasFiltradas().filter(c => Number(c.id_estado) === 3 || (c.nombre_estado && c.nombre_estado.toLowerCase().includes('listo')) || (c.estado && c.estado.toLowerCase().includes('listo')))
  );

  // 4. Servido en Mesa (id_estado = 4)
  servidosList = computed(() =>
    this.comandasFiltradas().filter(c => Number(c.id_estado) === 4 || (c.nombre_estado && (c.nombre_estado.toLowerCase().includes('servid') || c.nombre_estado.toLowerCase().includes('mesa'))) || (c.estado && (c.estado.toLowerCase().includes('servid') || c.estado.toLowerCase().includes('mesa'))))
  );

  pendientesCount = computed(() => this.pendientesList().length);
  preparandoCount = computed(() => this.preparandoList().length);
  listosCount     = computed(() => this.listosList().length);
  servidosCount   = computed(() => this.servidosList().length);
  totalCount      = computed(() => this.comandasFiltradas().length);

  ngOnInit() {
    this.load();
    this.interval = setInterval(() => this.load(false), 6000);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  load(showLoading = true) {
    if (showLoading && !this.comandas().length) {
      this.loading.set(true);
    }
    this.svc.getComandas().subscribe({
      next: (c: Comanda[]) => {
        const normalized = (c || []).map(item => {
          const rawNombre = item.nombre_estado || item.estado || '';
          const calculatedId = Number(item.id_estado) || this.getEstadoIdPorNombre(rawNombre);
          const nombreFinal = rawNombre || (calculatedId === 2 ? 'En Preparación' : calculatedId === 3 ? 'Listo' : calculatedId === 4 ? 'Servido' : 'Pendiente');
          return {
            ...item,
            id_estado: calculatedId,
            nombre_estado: nombreFinal,
            estado: nombreFinal
          };
        });

        // Filtrar pedidos que no estén cancelados ni cobrados y sincronizar estado
        const activas = normalized.filter(item => 
          !item.nombre_estado?.toLowerCase().includes('cancel') && 
          !item.estado?.toLowerCase().includes('cancel')
        );

        this.comandas.set(activas.sort((a, b) => (b.id_pedido || 0) - (a.id_pedido || 0)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private getEstadoIdPorNombre(nombre?: string): number {
    if (!nombre) return 1;
    const lower = nombre.toLowerCase();
    if (lower.includes('prepar')) return 2;
    if (lower.includes('listo')) return 3;
    if (lower.includes('servid') || lower.includes('mesa')) return 4;
    return 1;
  }

  // --- REGLAS DE BLOQUEO POR ROL ---
  isColumnLocked(colId: number): boolean {
    if (this.isAdmin()) return false;
    if (this.isMesero()) {
      return colId === 1 || colId === 2;
    }
    if (this.isCocinero()) {
      return colId === 4;
    }
    return false;
  }

  isCardDraggable(c: Comanda): boolean {
    if (this.isAdmin()) return true;
    const est = Number(c.id_estado);
    if (this.isMesero()) {
      return est === 3 || est === 4;
    }
    if (this.isCocinero()) {
      return est === 1 || est === 2 || est === 3;
    }
    return false;
  }

  // --- CAMBIO DE ESTADO SEGÚN ROL ---
  cambiarEstado(c: Comanda, nuevoEstadoId: number) {
    const estadoActual = Number(c.id_estado);
    if (estadoActual === nuevoEstadoId) return;

    if (this.isColumnLocked(nuevoEstadoId)) {
      this.alert.warningToast('Esta columna está bloqueada para tu rol.');
      return;
    }

    if (this.isCocinero()) {
      if (nuevoEstadoId === 4) {
        this.alert.warningToast('El Cocinero solo gestiona hasta "Listo para servir". El Mesero entrega a la mesa.');
        return;
      }
      if (estadoActual === 4) {
        this.alert.warningToast('No puedes modificar un pedido que ya fue servido.');
        return;
      }
    }

    if (this.isMesero()) {
      if (estadoActual === 1 || estadoActual === 2) {
        this.alert.warningToast('El Mesero no puede modificar pedidos en preparación de cocina.');
        return;
      }
      if (nuevoEstadoId === 1 || nuevoEstadoId === 2) {
        this.alert.warningToast('El Mesero solo puede gestionar pedidos entre "Listo para servir" y "Servido en Mesa".');
        return;
      }
    }

    const estadoNombres: Record<number, string> = {
      1: 'Pendiente',
      2: 'En Preparación',
      3: 'Listo',
      4: 'Servido'
    };
    const nombre = estadoNombres[nuevoEstadoId] || 'Pendiente';

    // Actualización optimista inmediata en la UI
    this.comandas.update(list =>
      list.map(item =>
        item.id_pedido === c.id_pedido
          ? { ...item, id_estado: nuevoEstadoId, nombre_estado: nombre, estado: nombre }
          : item
      )
    );

    this.svc.updateEstado(c.id_pedido, nuevoEstadoId).subscribe({
      next: () => {
        this.alert.successToast(`Pedido #${c.id_pedido} actualizado a "${nombre}"`);
        this.load(false);
      },
      error: e => {
        this.alert.error('Error al actualizar estado', e.error?.message || 'No se pudo actualizar el pedido');
        this.load(false);
      }
    });
  }

  // --- HTML5 DRAG AND DROP KANBAN ---
  onDragStart(event: DragEvent, c: Comanda) {
    if (!this.isCardDraggable(c)) {
      event.preventDefault();
      return;
    }
    this.draggedComanda = c;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(c.id_pedido));
    }
  }

  onDragOver(event: DragEvent, colId: number) {
    if (this.isColumnLocked(colId)) {
      return;
    }
    event.preventDefault();
    this.dragOverColId.set(colId);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDragLeave(event: DragEvent) {
    this.dragOverColId.set(null);
  }

  onDrop(event: DragEvent, targetEstadoId: number) {
    event.preventDefault();
    this.dragOverColId.set(null);
    if (!this.draggedComanda) return;
    if (this.isColumnLocked(targetEstadoId)) {
      this.alert.warningToast('Esta columna está bloqueada para tu rol.');
      this.draggedComanda = null;
      return;
    }
    const c = this.draggedComanda;
    this.draggedComanda = null;
    this.cambiarEstado(c, targetEstadoId);
  }

  onDragEnd() {
    this.draggedComanda = null;
    this.dragOverColId.set(null);
  }

  getInitials(name?: string): string {
    if (!name) return 'ME';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getAvatarColor(name?: string): string {
    if (!name) return '#b91c1c';
    const colors = ['#b91c1c', '#15803d', '#7e22ce', '#0369a1', '#b45309', '#047857', '#be185d', '#4338ca'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  tiempoTranscurrido(fecha: string) {
    if (!fecha) return '0 min';
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Ahora mismo';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h ${min % 60}min`;
  }

  formatearFechaHora(fecha: string): string {
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
