import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuService } from '../../core/services/menu.service';
import { InventarioService } from '../../core/services/inventario.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { Producto, Categoria, Ingrediente } from '../../core/models';

export interface PlatilloIngredienteItem {
  id_ingrediente: number;
  nombre_ingrediente: string;
  unidad_medida: string;
  cantidad_necesaria: number;
}

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
  private svc = inject(MenuService);
  private inventarioSvc = inject(InventarioService);
  private auth = inject(AuthService);
  private alert = inject(AlertService);

  productos  = signal<Producto[]>([]);
  categorias = signal<Categoria[]>(DEFAULT_CATEGORIAS);
  loading    = signal(true);
  catActiva  = signal(0);
  search     = signal('');
  showModal  = signal(false);
  isEdit     = signal(false);
  editProd   = signal<Partial<Producto>>({});
  isAdmin    = computed(() => this.auth.hasRole(['Administrador']));

  // Ingredientes & Receta
  ingredientesDisponibles = signal<Ingrediente[]>([]);
  recetaIngredientes = signal<PlatilloIngredienteItem[]>([]);
  selectedIngredienteId = signal<number | null>(null);
  selectedCantidad = signal<number>(1);

  filtrados = computed(() => {
    let list = this.productos();
    const catId = Number(this.catActiva());
    const query = this.search().toLowerCase().trim();

    if (catId > 0) {
      const catObj = this.categorias().find(c => Number(c.id_categoria) === catId);
      const catName = catObj?.nombre_categoria?.toLowerCase().trim();

      list = list.filter(p => {
        const pCatId = Number(p.id_categoria);
        if (pCatId && pCatId === catId) return true;
        if (p.nombre_categoria && catName && p.nombre_categoria.toLowerCase().trim() === catName) return true;
        return false;
      });
    }

    if (query) {
      list = list.filter(p =>
        p.nombre_producto.toLowerCase().includes(query) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(query))
      );
    }

    return list;
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.svc.getMenu().subscribe({
      next: p => {
        this.productos.set(p);
        this.loading.set(false);
      },
      error: e => {
        this.alert.error('Error al cargar menú', e.error?.message);
        this.loading.set(false);
      }
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

    this.inventarioSvc.getIngredientes().subscribe({
      next: ings => this.ingredientesDisponibles.set(ings || []),
      error: () => {}
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
    this.recetaIngredientes.set([]);
    this.selectedIngredienteId.set(null);
    this.selectedCantidad.set(1);
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
    this.recetaIngredientes.set([]);
    this.selectedIngredienteId.set(null);
    this.selectedCantidad.set(1);
    this.isEdit.set(true);
    this.showModal.set(true);

    if (p.id_producto) {
      this.inventarioSvc.getReceta(p.id_producto).subscribe({
        next: (rec: any) => {
          if (rec && Array.isArray(rec)) {
            const mapped: PlatilloIngredienteItem[] = rec.map((r: any) => {
              const matched = this.ingredientesDisponibles().find(i => Number(i.id_ingrediente) === Number(r.id_ingrediente));
              return {
                id_ingrediente: Number(r.id_ingrediente),
                nombre_ingrediente: r.nombre_ingrediente || matched?.nombre_ingrediente || 'Ingrediente',
                unidad_medida: r.unidad_medida || matched?.unidad_medida || '',
                cantidad_necesaria: Number(r.cantidad_necesaria || 1)
              };
            });
            this.recetaIngredientes.set(mapped);
          }
        },
        error: (err) => {
          console.error('Error al cargar receta:', err);
        }
      });
    }
  }

  addIngrediente() {
    const id = this.selectedIngredienteId();
    const qty = Number(this.selectedCantidad());
    if (!id) {
      this.alert.warningToast('Selecciona un ingrediente del inventario');
      return;
    }
    if (!qty || qty <= 0) {
      this.alert.warningToast('Ingresa una cantidad válida mayor a 0');
      return;
    }

    const ing = this.ingredientesDisponibles().find(i => Number(i.id_ingrediente) === Number(id));
    if (!ing) return;

    const current = this.recetaIngredientes();
    const existingIndex = current.findIndex(i => Number(i.id_ingrediente) === Number(id));

    if (existingIndex >= 0) {
      const updated = [...current];
      updated[existingIndex] = {
        ...updated[existingIndex],
        cantidad_necesaria: Number((updated[existingIndex].cantidad_necesaria + qty).toFixed(2))
      };
      this.recetaIngredientes.set(updated);
      this.alert.successToast(`Cantidad actualizada para ${ing.nombre_ingrediente}`);
    } else {
      this.recetaIngredientes.update(list => [
        ...list,
        {
          id_ingrediente: ing.id_ingrediente,
          nombre_ingrediente: ing.nombre_ingrediente,
          unidad_medida: ing.unidad_medida,
          cantidad_necesaria: qty
        }
      ]);
    }

    this.selectedIngredienteId.set(null);
    this.selectedCantidad.set(1);
  }

  removeIngrediente(index: number) {
    this.recetaIngredientes.update(list => list.filter((_, i) => i !== index));
  }

  getSelectedIngredienteUnidad(): string {
    const id = this.selectedIngredienteId();
    if (!id) return '';
    const ing = this.ingredientesDisponibles().find(i => Number(i.id_ingrediente) === Number(id));
    return ing ? ing.unidad_medida : '';
  }

  save() {
    const d = this.editProd();
    if (!d.nombre_producto?.trim()) {
      this.alert.warningToast('Ingresa el nombre del platillo');
      return;
    }

    const currentIngredientes = this.recetaIngredientes().map(i => ({
      id_ingrediente: Number(i.id_ingrediente),
      cantidad_necesaria: Number(i.cantidad_necesaria)
    }));

    const payload = {
      ...d,
      id_categoria: Number(d.id_categoria || 1),
      ingredientes: currentIngredientes
    };

    const obs = this.isEdit()
      ? this.svc.updateProducto(d.id_producto!, payload)
      : this.svc.createProducto(payload);

    obs.subscribe({
      next: (res: any) => {
        const prodId = this.isEdit() ? d.id_producto! : res?.id_producto;
        if (prodId) {
          this.inventarioSvc.saveReceta(prodId, currentIngredientes).subscribe({
            next: () => {},
            error: () => {}
          });
        }
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

  getCatNombre(p: any) {
    if (typeof p === 'object' && p !== null) {
      if (p.nombre_categoria) return p.nombre_categoria;
      const found = this.categorias().find(c => Number(c.id_categoria) === Number(p.id_categoria));
      return found?.nombre_categoria ?? 'General';
    }
    const id = Number(p);
    return this.categorias().find(c => Number(c.id_categoria) === id)?.nombre_categoria ?? 'General';
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
