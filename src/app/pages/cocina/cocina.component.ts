import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CocinaService } from '../../core/services/cocina.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { Comanda } from '../../core/models';

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './cocina.component.html',
  styleUrl: './cocina.component.scss'
})
export class CocinaComponent implements OnInit, OnDestroy {
  private svc = inject(CocinaService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);

  comandas = signal<Comanda[]>([]);
  busqueda = signal('');
  loading  = signal(true);
  draggedComanda: Comanda | null = null;
  dragOverColId = signal<number | null>(null);
  private interval: any;

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
      const comandaText = `comanda #${c.id_pedido}`.toLowerCase();
      const tituloCombinado = `mesa ${c.numero_mesa} | comanda #${c.id_pedido}`.toLowerCase();
      const numMesa = String(c.numero_mesa || '');
      const numPedido = String(c.id_pedido || '');
      const hashPedido = `#${c.id_pedido}`;

      if (
        mesaText.includes(q) ||
        comandaText.includes(q) ||
        tituloCombinado.includes(q) ||
        numMesa === q ||
        numPedido === q ||
        hashPedido.includes(q)
      ) {
        return true;
      }

      if (c.mesero?.toLowerCase().includes(q)) return true;
      if (c.detalles?.some(d => d.nombre_producto?.toLowerCase().includes(q))) return true;

      return false;
    });
  });

  // 1. Pendientes por iniciar (id_estado = 1)
  pendientesList = computed(() =>
    this.comandasFiltradas().filter(c => Number(c.id_estado) === 1 || c.nombre_estado?.toLowerCase().includes('pendiente'))
  );

  // 2. Preparándose (id_estado = 2)
  preparandoList = computed(() =>
    this.comandasFiltradas().filter(c => Number(c.id_estado) === 2 || c.nombre_estado?.toLowerCase().includes('prepar'))
  );

  // 3. Listo para servir (id_estado = 3)
  listosList = computed(() =>
    this.comandasFiltradas().filter(c => Number(c.id_estado) === 3 || c.nombre_estado?.toLowerCase().includes('listo'))
  );

  // 4. Servido en Mesa (id_estado = 4)
  servidosList = computed(() =>
    this.comandasFiltradas().filter(c => Number(c.id_estado) === 4 || c.nombre_estado?.toLowerCase().includes('servid') || c.nombre_estado?.toLowerCase().includes('mesa'))
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
        const normalized = (c || []).map(item => ({
          ...item,
          id_estado: Number(item.id_estado) || this.getEstadoIdPorNombre(item.nombre_estado)
        }));
        this.comandas.set(normalized);
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
        this.alert.warningToast('No puedes modificar una comanda que ya fue servida.');
        return;
      }
    }

    if (this.isMesero()) {
      if (estadoActual === 1 || estadoActual === 2) {
        this.alert.warningToast('El Mesero no puede modificar comandas en preparación de cocina.');
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
        this.alert.successToast(`Comanda #${c.id_pedido} actualizada a "${nombre}"`);
        this.load(false);
      },
      error: e => {
        this.alert.error('Error al actualizar estado', e.error?.message || 'No se pudo actualizar la comanda');
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
