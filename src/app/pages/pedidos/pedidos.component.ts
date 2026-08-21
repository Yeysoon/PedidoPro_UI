import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService } from '../../core/services/menu.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { AlertService } from '../../core/services/alert.service';
import { Producto, Categoria, DetallePedido } from '../../core/models';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './pedidos.component.html',
  styleUrl: './pedidos.component.scss'
})
export class PedidosComponent implements OnInit {
  mesaId  = signal(0);
  mesaNum = signal(0);
  productos = signal<Producto[]>([]);
  categorias = signal<Categoria[]>([]);
  carrito   = signal<DetallePedido[]>([]);
  catActiva = signal(0);
  notas     = signal('');
  loading   = signal(true);
  sending   = signal(false);

  filtrados = () => {
    const p = this.productos();
    const cat = this.catActiva();
    return cat ? p.filter(x => x.id_categoria === cat && x.disponible) : p.filter(x => x.disponible);
  };

  total = () => this.carrito().reduce((s, d) => s + ((d.precio_unitario_historico ?? 0) * d.cantidad), 0);
  cantTotal = () => this.carrito().reduce((s, d) => s + d.cantidad, 0);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuSvc: MenuService,
    private pedidosSvc: PedidosService,
    private alert: AlertService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      this.mesaId.set(+p['mesa'] || 0);
      this.mesaNum.set(+p['num'] || 0);
    });
    this.menuSvc.getMenu().subscribe({ next: p => { this.productos.set(p); this.loading.set(false); } });
    this.menuSvc.getCategorias().subscribe({ next: c => this.categorias.set(c) });
  }

  agregar(p: Producto) {
    const items = this.carrito();
    const idx = items.findIndex(i => i.id_producto === p.id_producto);
    if (idx >= 0) {
      const updated = [...items];
      updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 };
      this.carrito.set(updated);
    } else {
      this.carrito.update(c => [...c, {
        id_producto: p.id_producto,
        cantidad: 1,
        precio_unitario_historico: p.precio,
        notas_especiales: '',
        nombre_producto: p.nombre_producto
      }]);
    }
  }

  agregarById(id: number) {
    const p = this.productos().find(x => x.id_producto === id);
    if (p) this.agregar(p);
  }

  quitar(id: number) {
    const items = this.carrito();
    const idx = items.findIndex(i => i.id_producto === id);
    if (idx < 0) return;
    const updated = [...items];
    if (updated[idx].cantidad > 1) {
      updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad - 1 };
      this.carrito.set(updated);
    } else {
      this.carrito.update(c => c.filter(i => i.id_producto !== id));
    }
  }

  getQty(id: number) {
    return this.carrito().find(i => i.id_producto === id)?.cantidad ?? 0;
  }

  enviar() {
    if (!this.mesaId()) {
      this.alert.warningToast('Selecciona una mesa antes de enviar');
      return;
    }
    if (!this.carrito().length) {
      this.alert.warningToast('Agrega al menos un producto a la comanda');
      return;
    }

    this.sending.set(true);
    this.pedidosSvc.createPedido({
      id_mesa: this.mesaId(),
      notas_generales: this.notas(),
      detalles: this.carrito().map(d => ({
        id_producto: d.id_producto,
        cantidad: d.cantidad,
        notas_especiales: d.notas_especiales
      }))
    }).subscribe({
      next: () => {
        this.alert.success('Comanda Enviada', `La orden para la Mesa ${this.mesaNum()} fue enviada a Cocina.`);
        this.carrito.set([]);
        this.sending.set(false);
        setTimeout(() => this.router.navigate(['/mesas']), 400);
      },
      error: e => {
        this.alert.error('Error al enviar comanda', e.error?.message);
        this.sending.set(false);
      }
    });
  }

  getCatIcon(catId: number): string {
    const cat = this.categorias().find(c => c.id_categoria === catId)?.nombre_categoria ?? '';
    const m: Record<string, string> = {
      'Bebidas': 'local_bar',
      'Postres': 'cake',
      'Entradas': 'tapas',
      'Sopas': 'ramen_dining',
      'Mariscos': 'set_meal',
      'Carnes': 'kebab_dining',
      'Pastas': 'dinner_dining',
      'Pizzas': 'local_pizza'
    };
    return m[cat] ?? 'restaurant';
  }

  formatCurrency(n: number) {
    return 'Q ' + (+n).toFixed(2);
  }
}
