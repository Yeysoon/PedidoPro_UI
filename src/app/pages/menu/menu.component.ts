import { Component, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuService } from '../../core/services/menu.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { Producto, Categoria } from '../../core/models';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent implements OnInit {
  productos  = signal<Producto[]>([]);
  categorias = signal<Categoria[]>([]);
  loading    = signal(true);
  catActiva  = signal(0);
  search     = signal('');
  showModal  = signal(false);
  isEdit     = signal(false);
  editProd   = signal<Partial<Producto>>({});
  isAdmin    = computed(() => this.auth.hasRole(['Administrador']));

  filtrados = computed(() => {
    let list = this.productos();
    if (this.catActiva()) list = list.filter(p => p.id_categoria === this.catActiva());
    if (this.search()) list = list.filter(p => p.nombre_producto.toLowerCase().includes(this.search().toLowerCase()));
    return list;
  });

  constructor(
    private svc: MenuService,
    private auth: AuthService,
    private alert: AlertService
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.svc.getMenu().subscribe({
      next: p => { this.productos.set(p); this.loading.set(false); },
      error: e => { this.alert.error('Error al cargar menú', e.error?.message); this.loading.set(false); }
    });
    this.svc.getCategorias().subscribe({ next: c => this.categorias.set(c) });
  }

  openCreate() {
    this.editProd.set({ disponible: true, precio: 0, id_categoria: this.categorias()[0]?.id_categoria || 1 });
    this.isEdit.set(false);
    this.showModal.set(true);
  }

  openEdit(p: Producto) {
    this.editProd.set({ ...p });
    this.isEdit.set(true);
    this.showModal.set(true);
  }

  save() {
    const d = this.editProd();
    if (!d.nombre_producto?.trim()) {
      this.alert.warningToast('Ingresa el nombre del platillo');
      return;
    }
    const obs = this.isEdit()
      ? this.svc.updateProducto(d.id_producto!, d)
      : this.svc.createProducto(d);

    obs.subscribe({
      next: () => {
        this.alert.successToast(this.isEdit() ? 'Platillo actualizado' : 'Platillo agregado al menú');
        this.showModal.set(false);
        this.load();
      },
      error: e => this.alert.error('Error al guardar', e.error?.message)
    });
  }

  async delete(id: number) {
    const ok = await this.alert.confirm('¿Eliminar platillo?', 'Se quitará permanentemente del menú.', 'Sí, eliminar');
    if (!ok) return;

    this.svc.deleteProducto(id).subscribe({
      next: () => {
        this.alert.successToast('Platillo eliminado');
        this.load();
      },
      error: e => this.alert.error('Error al eliminar', e.error?.message)
    });
  }

  getCatNombre(id: number) {
    return this.categorias().find(c => c.id_categoria === id)?.nombre_categoria ?? 'General';
  }

  getCatIcon(cat: string): string {
    const m: Record<string, string> = {
      'Bebidas': 'pi pi-glass',
      'Postres': 'pi pi-sparkles',
      'Entradas': 'pi pi-tag',
      'Sopas': 'pi pi-compass',
      'Mariscos': 'pi pi-star',
      'Carnes': 'pi pi-box',
      'Pastas': 'pi pi-palette',
      'Pizzas': 'pi pi-circle'
    };
    return m[cat] ?? 'pi pi-book';
  }

  update(f: string, v: any) {
    this.editProd.update(p => ({ ...p, [f]: v }));
  }

  formatCurrency(n: number) {
    return 'Q ' + (+n).toFixed(2);
  }
}
