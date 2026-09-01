import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface AdminStats {
  ventas_hoy: number;
  pedidos_activos: number;
  mesas_ocupadas: number;
  alertas_inventario: number;
}

export interface MeseroStats {
  resumen_mesas: { estado: string; cantidad: number }[];
  mis_pedidos_activos: number;
  mesas: { id_mesa: number; numero_mesa: number; estado: string; nombre_zona: string }[];
}

export interface CocinaStats {
  comandas_pendientes: number;
  comandas_en_preparacion: number;
}

export interface CajaStats {
  pedidos_listos: number;
  ingresos_hoy: number;
  facturas_emitidas_hoy: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private api: ApiService) {}

  getAdminStats(): Observable<{ success: boolean; data: AdminStats }> {
    return this.api.get<{ success: boolean; data: AdminStats }>('/api/dashboard/admin');
  }

  getMeseroStats(): Observable<{ success: boolean; data: MeseroStats }> {
    return this.api.get<{ success: boolean; data: MeseroStats }>('/api/dashboard/mesero');
  }

  getCocinaStats(): Observable<{ success: boolean; data: CocinaStats }> {
    return this.api.get<{ success: boolean; data: CocinaStats }>('/api/dashboard/cocina');
  }

  getCajaStats(): Observable<{ success: boolean; data: CajaStats }> {
    return this.api.get<{ success: boolean; data: CajaStats }>('/api/dashboard/caja');
  }
}
