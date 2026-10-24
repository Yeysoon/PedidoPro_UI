import { Component, signal, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventarioService } from '../../core/services/inventario.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { Ingrediente } from '../../core/models';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss'
})
export class InventarioComponent implements OnInit, OnDestroy {
  private svc = inject(InventarioService);
  private auth = inject(AuthService);
  private alert = inject(AlertService);

  isAdmin = computed(() => this.auth.hasRole(['Administrador']));
  ingredientes = signal<Ingrediente[]>([]);
  loading      = signal(true);
  showModal    = signal(false);
  isEdit       = signal(false);
  editItem     = signal<Partial<Ingrediente>>({});
  search       = signal('');
  private interval: any;

  readonly UNIDADES_MEDIDA = [
    {
      grupo: 'Peso y Masa',
      unidades: [
        'Kilogramos (kg)',
        'Gramos (g)',
        'Libras (lb)',
        'Onzas (oz)',
        'Miligramos (mg)'
      ]
    },
    {
      grupo: 'Volumen y Líquidos',
      unidades: [
        'Litros (L)',
        'Mililitros (ml)',
        'Galones (gal)',
        'Onzas líquidas (fl oz)',
        'Botellas',
        'Latas',
        'Tetrapack'
      ]
    },
    {
      grupo: 'Unidades y Conteo',
      unidades: [
        'Unidades (u)',
        'Piezas (pz)',
        'Porciones',
        'Docenas',
        'Cajas',
        'Paquetes (paq)',
        'Bolsas',
        'Frascos',
        'Bandejas',
        'Manojo / Atado'
      ]
    },
    {
      grupo: 'Medidas Culinarias',
      unidades: [
        'Cucharadas (cda)',
        'Cucharaditas (cdta)',
        'Tazas (tz)',
        'Pizca',
        'Rodajas / Rebanadas'
      ]
    }
  ];

  isUnitInCatalog(unit?: string): boolean {
    if (!unit) return true;
    return this.UNIDADES_MEDIDA.some(cat => cat.unidades.includes(unit));
  }

  filtered = () => {
    const s = this.search().toLowerCase();
    return s ? this.ingredientes().filter(i => i.nombre_ingrediente.toLowerCase().includes(s)) : this.ingredientes();
  };

  ngOnInit() {
    this.load();
    this.interval = setInterval(() => this.load(false), 3000);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  load(showLoading = true) {
    if (showLoading) this.loading.set(true);
    this.svc.getIngredientes().subscribe({
      next: i => { this.ingredientes.set(i); if (showLoading) this.loading.set(false); },
      error: () => { if (showLoading) this.loading.set(false); }
    });
  }

  openCreate() {
    this.editItem.set({
      nombre_ingrediente: '',
      unidad_medida: 'Unidades (u)',
      stock_actual: 0
    });
    this.isEdit.set(false);
    this.showModal.set(true);
  }

  openEdit(i: Ingrediente) {
    this.editItem.set({ ...i });
    this.isEdit.set(true);
    this.showModal.set(true);
  }

  onStockKeyDown(event: KeyboardEvent) {
    if (event.key === '-' || event.key === '+' || event.key === 'e' || event.key === 'E') {
      event.preventDefault();
    }
  }

  onStockInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let raw = input.value;
    if (raw === '' || raw === null || raw === undefined) {
      this.update('stock_actual', 0);
      return;
    }
    let val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      val = 0;
      input.value = '0';
    }
    this.update('stock_actual', val);
  }

  save() {
    const d = this.editItem();
    if (!d.nombre_ingrediente?.trim()) {
      this.alert.warningToast('Ingresa el nombre del insumo');
      return;
    }

    const stock = Number(d.stock_actual ?? 0);
    if (isNaN(stock) || stock < 0) {
      this.alert.warningToast('El stock disponible no puede ser un valor negativo');
      return;
    }

    const payload = {
      ...d,
      nombre_ingrediente: d.nombre_ingrediente.trim(),
      stock_actual: stock
    };

    const obs = this.isEdit()
      ? this.svc.updateIngrediente(d.id_ingrediente!, payload)
      : this.svc.createIngrediente(payload);

    obs.subscribe({
      next: () => {
        this.alert.successToast(this.isEdit() ? 'Insumo actualizado' : 'Insumo registrado');
        this.showModal.set(false);
        this.load();
      },
      error: e => this.alert.error('Error al guardar', e.error?.message)
    });
  }

  async delete(id: number) {
    const ok = await this.alert.confirm('¿Eliminar insumo?', 'Se quitará del control de inventario.', 'Sí, eliminar');
    if (!ok) return;

    this.svc.deleteIngrediente(id).subscribe({
      next: () => {
        this.alert.successToast('Insumo eliminado');
        this.load();
      },
      error: e => this.alert.error('Error al eliminar', e.error?.message)
    });
  }

  update(f: string, v: any) {
    this.editItem.update(i => ({ ...i, [f]: v }));
  }

  getStockClass(s: number) {
    return s <= 5 ? 'badge-ocupada' : s <= 20 ? 'badge-pendiente' : 'badge-listo';
  }
}
