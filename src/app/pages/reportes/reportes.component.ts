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
    this.loading.set(true);
    this.svc.getVentas().subscribe({
      next: (v: any) => {
        const list: VentaReporte[] = Array.isArray(v) ? v : (v?.data || []);
        this.ventas.set(list);
        const total = list.reduce((s, x) => s + +x.total_ventas, 0);
        this.totalGeneral.set(total);
        this.avgDiario.set(list.length ? total / list.length : 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
    this.svc.getProductosTop().subscribe({
      next: (p: any) => {
        const list = Array.isArray(p) ? p : [];
        this.productosTop.set(list);
      },
      error: () => {}
    });
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

