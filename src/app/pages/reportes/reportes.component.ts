import { SlicePipe } from '@angular/common';
import { Component, signal, OnInit } from '@angular/core';
import { ReportesService } from '../../core/services/reportes.service';
import { VentaReporte, ProductoTop } from '../../core/models';

@Component({ selector: 'app-reportes', standalone: true, imports: [SlicePipe],
  templateUrl: './reportes.component.html', styleUrl: './reportes.component.scss' })
export class ReportesComponent implements OnInit {
  ventas       = signal<VentaReporte[]>([]);
  productosTop = signal<ProductoTop[]>([]);
  loading      = signal(true);
  totalGeneral = signal(0);
  avgDiario    = signal(0);

  constructor(private svc: ReportesService) {}
  ngOnInit() { this.load(); }
  load() {
    this.svc.getVentas().subscribe({ next: v => {
      this.ventas.set(v);
      const total = v.reduce((s, x) => s + +x.total_ventas, 0);
      this.totalGeneral.set(total);
      this.avgDiario.set(v.length ? total / v.length : 0);
      this.loading.set(false);
    }});
    this.svc.getProductosTop().subscribe({ next: p => this.productosTop.set(p) });
  }
  getBarH(val: number): string {
    const max = Math.max(...this.ventas().map(v => +v.total_ventas), 1);
    return ((+val / max) * 140) + 'px';
  }
  getTopW(val: number): string {
    const max = Math.max(...this.productosTop().map(p => +p.total_vendido), 1);
    return ((+val / max) * 100) + '%';
  }
  formatCurrency(n: number) { return 'Q ' + (+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
}

