import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Pedido, FacturarRequest, Factura } from '../models';

@Injectable({ providedIn: 'root' })
export class CajaService {
  constructor(private api: ApiService) {}
  getPedidosListos()                { return this.api.get<Pedido[]>('/api/caja/pedidos-listos'); }
  facturar(data: FacturarRequest)   { return this.api.post<Factura>('/api/caja/facturar', data); }
  anularFactura(id: number)         { return this.api.delete<any>(`/api/caja/facturas/${id}/anular`); }
}
