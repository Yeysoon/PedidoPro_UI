import { Component, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuService } from '../../core/services/menu.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { Producto, Categoria } from '../../core/models';

const DEFAULT_CATEGORIAS: Categoria[] = [
  { id_categoria: 4, nombre_categoria: 'Entradas' },
  { id_categoria: 2, nombre_categoria: 'Bebidas' },
  { id_categoria: 1, nombre_categoria: 'Platos Fuertes' },
  { id_categoria: 3, nombre_categoria: 'Postres' }
];

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent implements OnInit {
  productos  = signal<Producto[]>([]);
  categorias = signal<Categoria[]>(DEFAULT_CATEGORIAS);
  loading    = signal(true);
  catActiva  = signal(0);
  search     = signal('');
  showModal  = signal(false);
  isEdit     = signal(false);
  editProd   = signal<Partial<Producto>>({});
  isAdmin    = computed(() => this.auth.hasRole(['Administrador']));

  filtrados = computed(() => {
    let list = this.productos();
    if (this.catActiva()) list = list.filter(p => Number(p.id_categoria) === Number(this.catActiva()));
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
    this.svc.getCategorias().subscribe({
      next: c => {
        if (c && c.length > 0) {
          this.categorias.set(c);
        } else {
          this.categorias.set(DEFAULT_CATEGORIAS);
        }
      },
      error: () => {
        this.categorias.set(DEFAULT_CATEGORIAS);
      }
    });
  }

  openCreate() {
    const firstCat = this.categorias()[0]?.id_categoria || 1;
    this.editProd.set({
      nombre_producto: '',
      descripcion: '',
      disponible: true,
      precio: 0,
      id_categoria: Number(firstCat)
    });
    this.isEdit.set(false);
    this.showModal.set(true);
  }

  openEdit(p: Producto) {
    let catId = p.id_categoria;
    if (!catId && p.nombre_categoria) {
      const found = this.categorias().find(c => c.nombre_categoria.toLowerCase() === p.nombre_categoria?.toLowerCase());
      if (found) catId = found.id_categoria;
    }
    if (!catId) catId = 1;

    this.editProd.set({
      ...p,
      id_categoria: Number(catId)
    });
    this.isEdit.set(true);
    this.showModal.set(true);
  }

  save() {
    const d = this.editProd();
    if (!d.nombre_producto?.trim()) {
      this.alert.warningToast('Ingresa el nombre del platillo');
      return;
    }
    const payload = {
      ...d,
      id_categoria: Number(d.id_categoria || 1)
    };

    const obs = this.isEdit()
      ? this.svc.updateProducto(d.id_producto!, payload)
      : this.svc.createProducto(payload);

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
    return this.categorias().find(c => Number(c.id_categoria) === Number(id))?.nombre_categoria ?? 'General';
  }

  getCatIcon(cat: string): string {
    const name = (cat || '').toLowerCase();
    if (name.includes('entrada')) return 'pi pi-tag';
    if (name.includes('bebida')) return 'pi pi-glass';
    if (name.includes('fuerte') || name.includes('plato')) return 'pi pi-box';
    if (name.includes('postre')) return 'pi pi-sparkles';
    return 'pi pi-book';
  }

  update(f: string, v: any) {
    this.editProd.update(p => ({ ...p, [f]: v }));
  }

  formatCurrency(n: number) {
    return 'Q ' + (+n).toFixed(2);
  }
}
