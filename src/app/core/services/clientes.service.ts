import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Cliente } from '../models';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  constructor(private api: ApiService) {}
  getClientes()                              { return this.api.get<Cliente[]>('/api/clientes'); }
  getCliente(id: number)                     { return this.api.get<Cliente>(`/api/clientes/${id}`); }
  createCliente(d: Partial<Cliente>)         { return this.api.post<Cliente>('/api/clientes', d); }
  updateCliente(id: number, d: Partial<Cliente>) { return this.api.put<Cliente>(`/api/clientes/${id}`, d); }
  deleteCliente(id: number)                  { return this.api.delete<any>(`/api/clientes/${id}`); }
}
