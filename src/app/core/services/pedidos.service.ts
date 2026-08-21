import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Pedido, DetallePedido } from '../models';

@Injectable({ providedIn: 'root' })
export class PedidosService {
  constructor(private api: ApiService) {}
  createPedido(data: { id_mesa: number; notas_generales?: string; detalles: DetallePedido[] }) {
    return this.api.post<Pedido>('/api/pedidos', data);
  }
  getCuentaMesa(id_mesa: number) { return this.api.get<Pedido[]>(`/api/pedidos/mesa/${id_mesa}`); }
  cancelPedido(id: number)       { return this.api.patch<any>(`/api/pedidos/${id}/cancelar`); }
}
