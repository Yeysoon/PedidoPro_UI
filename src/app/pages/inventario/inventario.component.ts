import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventarioService } from '../../core/services/inventario.service';
import { AlertService } from '../../core/services/alert.service';
import { Ingrediente } from '../../core/models';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss'
})
export class InventarioComponent implements OnInit {
  ingredientes = signal<Ingrediente[]>([]);
  loading      = signal(true);
  showModal    = signal(false);
  isEdit       = signal(false);
  editItem     = signal<Partial<Ingrediente>>({});
  search       = signal('');

  filtered = () => {
    const s = this.search().toLowerCase();
    return s ? this.ingredientes().filter(i => i.nombre_ingrediente.toLowerCase().includes(s)) : this.ingredientes();
  };

  constructor(
    private svc: InventarioService,
    private alert: AlertService
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc.getIngredientes().subscribe({
      next: i => { this.ingredientes.set(i); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openCreate() {
    this.editItem.set({
      nombre_ingrediente: '',
      unidad_medida: '',
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

  save() {
    const d = this.editItem();
    if (!d.nombre_ingrediente?.trim()) {
      this.alert.warningToast('Ingresa el nombre del insumo');
      return;
    }
    const obs = this.isEdit()
      ? this.svc.updateIngrediente(d.id_ingrediente!, d)
      : this.svc.createIngrediente(d);

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
