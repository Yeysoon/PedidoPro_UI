import { Component, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MesasService } from '../../core/services/mesas.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { Mesa, Zona } from '../../core/models';

const DEFAULT_ZONAS: Zona[] = [
  { id_zona: 1, nombre_zona: 'Salón Principal' },
  { id_zona: 2, nombre_zona: 'Terraza' },
  { id_zona: 3, nombre_zona: 'Área VIP' },
  { id_zona: 4, nombre_zona: 'Barra' }
];

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.scss'
})
export class MesasComponent implements OnInit {
  mesas = signal<Mesa[]>([]);
  zonas = signal<Zona[]>(DEFAULT_ZONAS);
  loading = signal(true);
  showModal = signal(false);
  editMesa = signal<Partial<Mesa>>({});
  isEdit = signal(false);
  filterZona = signal(0);
  filterEstado = signal('');
  isAdmin = computed(() => this.auth.hasRole(['Administrador']));

  filteredMesas = computed(() => {
    let list = this.mesas();
    if (this.filterZona()) list = list.filter(m => +m.id_zona === +this.filterZona());
    if (this.filterEstado()) list = list.filter(m => m.estado === this.filterEstado());
    return list;
  });

  libresCount = computed(() => this.mesas().filter(m => m.estado === 'Libre').length);
  ocupadasCount = computed(() => this.mesas().filter(m => m.estado === 'Ocupada').length);

  constructor(
    private svc: MesasService,
    private auth: AuthService,
    private alert: AlertService,
    private router: Router
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc.getMesas().subscribe({
      next: m => {
        this.mesas.set(m);
        this.loading.set(false);
      },
      error: e => {
        this.alert.error('Error al cargar mesas', e.error?.message);
        this.loading.set(false);
      }
    });

    this.svc.getZonas().subscribe({
      next: z => {
        if (z && z.length > 0) {
          this.zonas.set(z);
        } else {
          this.zonas.set(DEFAULT_ZONAS);
        }
      },
      error: () => {
        this.zonas.set(DEFAULT_ZONAS);
      }
    });
  }

  openPedido(mesa: Mesa) {
    if (mesa.estado !== 'Libre') {
      this.alert.warningToast(`La Mesa ${mesa.numero_mesa} está ${mesa.estado}`);
      return;
    }
    this.router.navigate(['/pedidos'], { queryParams: { mesa: mesa.id_mesa, num: mesa.numero_mesa } });
  }

  setEstado(mesa: Mesa, estado: string) {
    this.svc.updateEstado(mesa.id_mesa, estado).subscribe({
      next: () => {
        this.alert.successToast(`Mesa ${mesa.numero_mesa} marcada como ${estado}`);
        this.load();
      },
      error: e => this.alert.error('Error', e.error?.message)
    });
  }

  openCreate() {
    const defaultZona = +(this.zonas()[0]?.id_zona || 1);
    this.editMesa.set({ estado: 'Libre', capacidad: 4, id_zona: defaultZona });
    this.isEdit.set(false);
    this.showModal.set(true);
  }

  openEdit(m: Mesa) {
    this.editMesa.set({
      id_mesa: m.id_mesa,
      numero_mesa: m.numero_mesa,
      capacidad: m.capacidad,
      id_zona: +(m.id_zona || 1),
      estado: m.estado || 'Libre'
    });
    this.isEdit.set(true);
    this.showModal.set(true);
  }

  save() {
    const d = this.editMesa();
    if (!d.numero_mesa) {
      this.alert.warningToast('Ingresa el número de mesa');
      return;
    }
    const payload = {
      ...d,
      id_zona: +(d.id_zona || 1),
      numero_mesa: +d.numero_mesa,
      capacidad: +(d.capacidad || 4),
      estado: d.estado || 'Libre'
    };

    const obs = this.isEdit()
      ? this.svc.updateMesa(d.id_mesa!, payload)
      : this.svc.createMesa(payload);

    obs.subscribe({
      next: () => {
        this.alert.successToast(this.isEdit() ? 'Mesa actualizada' : 'Mesa creada');
        this.showModal.set(false);
        this.load();
      },
      error: e => this.alert.error('Error al guardar', e.error?.message)
    });
  }

  async deleteMesa(id: number) {
    const ok = await this.alert.confirm('¿Eliminar mesa?', 'Esta acción eliminará la mesa del plano.', 'Sí, eliminar');
    if (!ok) return;

    this.svc.deleteMesa(id).subscribe({
      next: () => {
        this.alert.successToast('Mesa eliminada');
        this.load();
      },
      error: e => this.alert.error('Error al eliminar', e.error?.message)
    });
  }

  getZonaNombre(id?: number) {
    if (!id) return 'Salón Principal';
    return this.zonas().find(z => +z.id_zona === +id)?.nombre_zona ?? 'Salón Principal';
  }

  getBadge(e: string) {
    return (e || 'libre').toLowerCase().replace('é','e').replace('ó','o').replace('ú','u');
  }

  update(field: keyof Mesa, val: any) {
    this.editMesa.update(m => ({ ...m, [field]: val }));
  }

  estadoOpts = ['Libre', 'Ocupada', 'Reservada', 'Mantenimiento'];
}
