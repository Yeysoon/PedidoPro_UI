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
  private interval: any;

  pendientes = computed(() => this.comandas().filter(c => c.id_estado === 1).length);
  preparando = computed(() => this.comandas().filter(c => c.id_estado === 2).length);
  listos     = computed(() => this.comandas().filter(c => c.id_estado === 3).length);

  estados = [
    { id: 1, nombre: 'Pendiente', next: 2, label: 'Iniciar Preparación', icon: 'pi pi-play' },
    { id: 2, nombre: 'En Preparación', next: 3, label: 'Marcar Listo', icon: 'pi pi-check' },
    { id: 3, nombre: 'Listo', next: null, label: null, icon: null },
  ];

  constructor(
    private svc: CocinaService,
    private alert: AlertService
  ) {}

  ngOnInit() {
    this.load();
    this.interval = setInterval(() => this.load(), 15000);
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

  load() {
    this.svc.getComandas().subscribe({
      next: c => { this.comandas.set(c); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  getEstado(id: number) {
    return this.estados.find(e => e.id === id);
  }

  getBadge(nombre: string) {
    const m: Record<string, string> = {
      'Pendiente': 'pendiente',
      'En Preparación': 'preparacion',
      'Listo': 'listo'
    };
    return m[nombre] ?? 'pendiente';
  }

  avanzar(c: Comanda) {
    const est = this.getEstado(c.id_estado);
    if (!est?.next) return;

    this.svc.updateEstado(c.id_pedido, est.next).subscribe({
      next: () => {
        this.alert.successToast(`Pedido #${c.id_pedido} actualizado`);
        this.load();
      },
      error: e => this.alert.error('Error', e.error?.message)
    });
  }

  tiempoTranscurrido(fecha: string) {
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h ${min % 60}min`;
  }
}
