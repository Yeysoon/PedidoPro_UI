import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { SlicePipe, CommonModule } from '@angular/common';
import { ReportesService } from '../../core/services/reportes.service';
import { MesasService } from '../../core/services/mesas.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { VentaReporte, ProductoTop, Mesa } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';

interface TransactionActivity {
  id: string;
  initials: string;
  initialClass: string;
  name: string;
  mesaTipo: string;
  date: string;
  status: string;
  statusType: 'success' | 'danger' | 'warning' | 'info';
  amount: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [SlicePipe, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private reportesSvc = inject(ReportesService);
  private mesasSvc = inject(MesasService);
  private usuariosSvc = inject(UsuariosService);

  user = signal(this.auth.getUser());
  loading = signal(true);

  // Period filter
  selectedPeriod = signal<'weekly' | 'monthly' | 'yearly'>('monthly');

  ventas = signal<VentaReporte[]>([]);
  productosTop = signal<ProductoTop[]>([]);
  mesas = signal<Mesa[]>([]);
  usuariosCount = signal<number>(0);

  totalHoy = signal(0);
  mesasLibres = signal(0);
  mesasOcupadas = signal(0);

  occupancyRate = computed(() => {
    const total = this.mesas().length;
    if (total === 0) return '0%';
    const ocupadas = this.mesasOcupadas();
    return Math.round((ocupadas / total) * 100) + '%';
  });

  // Sample recent operational transactions matching the PrimeNG table style
  recentActivity = signal<TransactionActivity[]>([
    { id: '#1254', initials: 'AE', initialClass: 'avatar-indigo', name: 'Amy Elsner', mesaTipo: 'Mesa 04 (Salón)', date: 'Hoy, 13:45', status: 'Pagado', statusType: 'success', amount: 'Q 345.00' },
    { id: '#2355', initials: 'AF', initialClass: 'avatar-sky', name: 'Anna Fali', mesaTipo: 'Mesa 12 (Terraza)', date: 'Hoy, 13:20', status: 'En Cocina', statusType: 'info', amount: 'Q 180.50' },
    { id: '#1235', initials: 'SS', initialClass: 'avatar-emerald', name: 'Stephen Shaw', mesaTipo: 'Para Llevar', date: 'Hoy, 12:50', status: 'Listo', statusType: 'success', amount: 'Q 95.00' },
    { id: '#4512', initials: 'MR', initialClass: 'avatar-amber', name: 'Marcos Ruiz', mesaTipo: 'Mesa 02 (Salón)', date: 'Hoy, 12:15', status: 'Pendiente', statusType: 'warning', amount: 'Q 260.00' },
    { id: '#5621', initials: 'CL', initialClass: 'avatar-rose', name: 'Carmen López', mesaTipo: 'Mesa 08 (VIP)', date: 'Hoy, 11:30', status: 'Cancelado', statusType: 'danger', amount: 'Q 520.00' }
  ]);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.reportesSvc.getVentas().subscribe({
      next: v => {
        this.ventas.set(v);
        const lastVenta = v[v.length - 1];
        this.totalHoy.set(lastVenta ? lastVenta.total_ventas : 2840.50);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.reportesSvc.getProductosTop().subscribe({
      next: p => this.productosTop.set(p.slice(0, 5))
    });

    this.mesasSvc.getMesas().subscribe({
      next: m => {
        this.mesas.set(m);
        this.mesasLibres.set(m.filter(x => x.estado === 'Libre').length);
        this.mesasOcupadas.set(m.filter(x => x.estado === 'Ocupada').length);
      }
    });

    this.usuariosSvc.getUsuarios().subscribe({
      next: u => this.usuariosCount.set(u.length)
    });
  }

  setPeriod(period: 'weekly' | 'monthly' | 'yearly') {
    this.selectedPeriod.set(period);
  }

  getBarHeight(val: number): string {
    const max = Math.max(...this.ventas().map(v => +v.total_ventas), 500);
    const pct = Math.min(Math.max((+val / max) * 100, 15), 100);
    return pct + '%';
  }

  getTopWidth(val: number): string {
    const max = Math.max(...this.productosTop().map(p => +p.total_vendido), 1);
    return Math.min(Math.max((+val / max) * 100, 10), 100) + '%';
  }

  formatCurrency(n: number): string {
    return 'Q ' + (+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}
