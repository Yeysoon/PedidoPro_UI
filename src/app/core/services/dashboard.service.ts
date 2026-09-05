import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface MixCategoriaItem {
  id_categoria: number;
  nombre_categoria: string;
  total_categoria: number;
  cantidad_vendida: number;
  porcentaje: number;
}

export interface PlatilloTopItem {
  id_producto: number;
  nombre_producto: string;
  nombre_categoria?: string;
  total_vendido: number;
  total_ingresos?: number;
}

export interface ActividadVentasItem {
  fecha: string;
  total_ventas: number;
  cantidad_facturas: number;
}

export interface ActividadRecienteItem {
  id_pedido: number;
  atendido_por: string;
  numero_mesa: number;
  nombre_zona: string;
  fecha_hora: string;
  estado: string;
  total: number;
}

export interface AdminStats {
  ventas_hoy: number;
  ventas_periodo: number;
  facturas_periodo: number;
  pedidos_activos: number;
  mesas_ocupadas: number;
  mesas_libres: number;
  total_mesas: number;
  alertas_inventario: number;
  actividad_ventas: ActividadVentasItem[];
  mix_facturacion: MixCategoriaItem[];
  total_mix_facturacion: number;
  platillos_top: PlatilloTopItem[];
  actividad_reciente: ActividadRecienteItem[];
}

export interface MeseroStats {
  resumen_mesas: { estado: string; cantidad: number }[];
  mis_pedidos_activos: number;
  mesas: { id_mesa: number; numero_mesa: number; estado: string; capacidad?: number; nombre_zona: string }[];
  mis_comandas?: { id_pedido: number; numero_mesa: number; nombre_zona: string; fecha_hora: string; estado: string; total: number }[];
}

export interface CocinaStats {
  comandas_pendientes: number;
  comandas_en_preparacion: number;
  comandas_listas_hoy?: number;
  insumos_criticos?: { id_ingrediente: number; nombre_ingrediente: string; unidad_medida: string; stock_actual: number; stock_minimo: number }[];
}

export interface CajaStats {
  pedidos_listos: number;
  ingresos_hoy: number;
  facturas_emitidas_hoy: number;
  ingresos_periodo?: number;
  facturas_periodo?: number;
  metodos_pago?: { nombre_metodo: string; total: number; cantidad: number }[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private api: ApiService) {}

  getAdminStats(period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Observable<{ success: boolean; data: AdminStats }> {
    return this.api.get<{ success: boolean; data: AdminStats }>(`/api/dashboard/admin?period=${period}`);
  }

  getMeseroStats(): Observable<{ success: boolean; data: MeseroStats }> {
    return this.api.get<{ success: boolean; data: MeseroStats }>('/api/dashboard/mesero');
  }

  getCocinaStats(): Observable<{ success: boolean; data: CocinaStats }> {
    return this.api.get<{ success: boolean; data: CocinaStats }>('/api/dashboard/cocina');
  }

  getCajaStats(period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Observable<{ success: boolean; data: CajaStats }> {
    return this.api.get<{ success: boolean; data: CajaStats }>(`/api/dashboard/caja?period=${period}`);
  }
}
