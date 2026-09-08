import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CocinaService } from '../../core/services/cocina.service';
import { AlertService } from '../../core/services/alert.service';
import { Comanda } from '../../core/models';

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [],
  templateUrl: './cocina.component.html',
  styleUrl: './cocina.component.scss'
})
export class CocinaComponent implements OnInit, OnDestroy {
  comandas = signal<Comanda[]>([]);
  loading  = signal(true);
  draggedComanda: Comanda | null = null;
  private interval: any;

  pendientesList = computed(() =>
    this.comandas().filter(c => c.id_estado === 1 || c.nombre_estado === 'Pendiente' || (c as any).estado === 'Pendiente')
  );

  preparandoList = computed(() =>
    this.comandas().filter(c => c.id_estado === 2 || c.nombre_estado === 'En Preparación' || (c as any).estado === 'En Preparación')
  );

  listosList = computed(() =>
    this.comandas().filter(c => c.id_estado === 3 || c.nombre_estado === 'Listo' || (c as any).estado === 'Listo')
  );

  pendientesCount = computed(() => this.pendientesList().length);
  preparandoCount = computed(() => this.preparandoList().length);
  listosCount     = computed(() => this.listosList().length);

  constructor(
    private svc: CocinaService,
    private alert: AlertService
  ) {}

  ngOnInit() {
    this.load();
    this.interval = setInterval(() => this.load(false), 10000);
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

  cambiarEstado(c: Comanda, nuevoEstadoId: number) {
    const estadoNombres: Record<number, string> = {
      1: 'Pendiente',
      2: 'En Preparación',
      3: 'Listo'
    };
    const nombre = estadoNombres[nuevoEstadoId] || 'Pendiente';

    // Actualización optimista local
    this.comandas.update(list =>
      list.map(item =>
        item.id_pedido === c.id_pedido
          ? { ...item, id_estado: nuevoEstadoId, nombre_estado: nombre, estado: nombre }
          : item
      )
    );

    this.svc.updateEstado(c.id_pedido, nuevoEstadoId).subscribe({
      next: () => {
        this.alert.successToast(`Comanda #${c.id_pedido} movida a "${nombre}"`);
        this.load(false);
      },
      error: e => {
        this.alert.error('Error al actualizar estado', e.error?.message);
        this.load(false);
      }
    });
  }

  // --- DRAG & DROP HTML5 API ---
  onDragStart(event: DragEvent, c: Comanda) {
    this.draggedComanda = c;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(c.id_pedido));
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, targetEstadoId: number) {
    event.preventDefault();
    if (!this.draggedComanda) return;
    if (this.draggedComanda.id_estado !== targetEstadoId) {
      this.cambiarEstado(this.draggedComanda, targetEstadoId);
    }
    this.draggedComanda = null;
  }

  onDragEnd() {
    this.draggedComanda = null;
  }

  tiempoTranscurrido(fecha: string) {
    if (!fecha) return '0 min';
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Justo ahora';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h ${min % 60}min`;
  }
}
