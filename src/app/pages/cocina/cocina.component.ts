import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { CocinaService } from '../../core/services/cocina.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { Comanda } from '../../core/models';

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [],
  templateUrl: './cocina.component.html',
  styleUrl: './cocina.component.scss'
})
export class CocinaComponent implements OnInit, OnDestroy {
  private svc = inject(CocinaService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);

  comandas = signal<Comanda[]>([]);
  loading  = signal(true);
  draggedComanda: Comanda | null = null;
  dragOverColId = signal<number | null>(null);
  private interval: any;

  // Roles
  userRole = computed(() => this.auth.getRole() || 'Administrador');
  isCocinero = computed(() => this.userRole() === 'Cocinero');
  isMesero = computed(() => this.userRole() === 'Mesero');
  isAdmin = computed(() => this.userRole() === 'Administrador');

  // 1. Pendientes por iniciar (id_estado = 1)
  pendientesList = computed(() =>
    this.comandas().filter(c => Number(c.id_estado) === 1 || c.nombre_estado === 'Pendiente' || (c as any).estado === 'Pendiente')
  );

  // 2. Preparándose (id_estado = 2)
  preparandoList = computed(() =>
    this.comandas().filter(c => Number(c.id_estado) === 2 || c.nombre_estado === 'En Preparación' || (c as any).estado === 'En Preparación')
  );

  // 3. Listo para servir (id_estado = 3)
  listosList = computed(() =>
    this.comandas().filter(c => Number(c.id_estado) === 3 || c.nombre_estado === 'Listo' || (c as any).estado === 'Listo')
  );

  // 4. Servido en Mesa (id_estado = 4)
  servidosList = computed(() =>
    this.comandas().filter(c => Number(c.id_estado) === 4 || c.nombre_estado === 'Servido' || (c as any).estado === 'Servido')
  );

  pendientesCount = computed(() => this.pendientesList().length);
  preparandoCount = computed(() => this.preparandoList().length);
  listosCount     = computed(() => this.listosList().length);
  servidosCount   = computed(() => this.servidosList().length);
  totalCount      = computed(() => this.comandas().length);

  ngOnInit() {
    this.load();
    this.interval = setInterval(() => this.load(false), 8000);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  load(showLoading = true) {
    if (showLoading && !this.comandas().length) {
      this.loading.set(true);
    }
    this.svc.getComandas().subscribe({
      next: c => {
        this.comandas.set(c);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // --- VALIDACIÓN Y CAMBIO DE ESTADO SEGÚN ROL ---
  cambiarEstado(c: Comanda, nuevoEstadoId: number) {
    const estadoActual = Number(c.id_estado);
    if (estadoActual === nuevoEstadoId) return;

    // Validación para COCINERO: solo puede gestionar estados 1, 2 y 3
    if (this.isCocinero()) {
      if (nuevoEstadoId === 4) {
        this.alert.warningToast('El Cocinero solo gestiona hasta "Listo para servir". El Mesero se encarga de servirlo en mesa.');
        return;
      }
      if (estadoActual === 4) {
        this.alert.warningToast('No puedes modificar una comanda que ya fue servida.');
        return;
      }
    }

    // Validación para MESERO: solo puede gestionar entre 3 (Listo) y 4 (Servido)
    if (this.isMesero()) {
      if (estadoActual === 1 || estadoActual === 2) {
        this.alert.warningToast('El Mesero solo puede gestionar pedidos que ya estén "Listos para servir".');
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
    this.draggedComanda = c;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(c.id_pedido));
    }
  }

  onDragOver(event: DragEvent, colId: number) {
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
