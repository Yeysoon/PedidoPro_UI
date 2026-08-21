import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Comanda } from '../models';

@Injectable({ providedIn: 'root' })
export class CocinaService {
  constructor(private api: ApiService) {}
  getComandas()                              { return this.api.get<Comanda[]>('/api/cocina/comandas'); }
  updateEstado(id: number, id_estado: number){ return this.api.patch<any>(`/api/cocina/comandas/${id}/estado`, { id_estado }); }
}
