import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { Pedido, FacturarRequest, Factura } from '../models';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FacturaHistorial {
  id_factura: number;
  id_pedido: number;
  fecha_hora_pago: string;
  subtotal: number;
  impuestos: number;
  propina: number;
  total_pagado: number;
  metodo_pago: string;
  cliente: string;
  cliente_nit?: string;
  cajero: string;
  mesero: string;
  numero_mesa: number;
}

@Injectable({ providedIn: 'root' })
export class CajaService {
  constructor(private api: ApiService, private http: HttpClient) {}

  getPedidosListos(): Observable<Pedido[]> { 
    return this.api.get<Pedido[]>('/api/caja/pedidos-listos'); 
  }

  facturar(data: FacturarRequest): Observable<any> { 
    return this.api.post<any>('/api/caja/facturar', data); 
  }

  getFacturas(params: { period?: string; search?: string; fechaInicio?: string; fechaFin?: string } = {}): Observable<{ data: FacturaHistorial[] }> {
    return this.api.get<{ data: FacturaHistorial[] }>('/api/caja/facturas', params);
  }

  getFacturaById(id: number): Observable<any> {
    return this.api.get<any>(`/api/caja/facturas/${id}`);
  }

  descargarFacturaPDF(id: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/api/caja/facturas/${id}/pdf`, { responseType: 'blob' });
  }

  anularFactura(id: number): Observable<any> { 
    return this.api.delete<any>(`/api/caja/facturas/${id}/anular`); 
  }
}
