import { Component, signal, OnInit, inject } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { ReportesService } from '../../core/services/reportes.service';
import { MesasService } from '../../core/services/mesas.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { VentaReporte, ProductoTop, Mesa } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';

@Component({ selector: 'app-dashboard', standalone: true, imports: [SlicePipe],
  templateUrl: './dashboard.component.html', styleUrl: './dashboard.component.scss' })
export class DashboardComponent implements OnInit {
  private auth        = inject(AuthService);
  private reportesSvc = inject(ReportesService);
  private mesasSvc    = inject(MesasService);
  private usuariosSvc = inject(UsuariosService);

  ventas       = signal<VentaReporte[]>([]);
  productosTop = signal<ProductoTop[]>([]);
  mesas        = signal<Mesa[]>([]);
  usuarios     = signal<number>(0);
  loading      = signal(true);
  user         = signal(this.auth.getUser());
  totalHoy     = signal(0);
  mesasLibres  = signal(0);
  mesasOcupadas= signal(0);

  ngOnInit() { this.load(); }

  load() {
    this.reportesSvc.getVentas().subscribe({ next: v => {
      this.ventas.set(v);
      this.totalHoy.set(v[v.length - 1]?.total_ventas ?? 0);
      this.loading.set(false);
    }});
    this.reportesSvc.getProductosTop().subscribe({ next: p => this.productosTop.set(p.slice(0,5)) });
    this.mesasSvc.getMesas().subscribe({ next: m => {
      this.mesas.set(m);
      this.mesasLibres.set(m.filter(x => x.estado === 'Libre').length);
      this.mesasOcupadas.set(m.filter(x => x.estado === 'Ocupada').length);
    }});
    this.usuariosSvc.getUsuarios().subscribe({ next: u => this.usuarios.set(u.length) });
  }

  getBarWidth(val: number): string {
    const max = Math.max(...this.productosTop().map(p => +p.total_vendido), 1);
    return ((+val / max) * 100) + '%';
  }
  formatCurrency(n: number): string { return 'Q ' + (+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
}
