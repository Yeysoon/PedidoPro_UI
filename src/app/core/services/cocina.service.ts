import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Comanda } from '../models';

@Injectable({ providedIn: 'root' })
export class CocinaService {
  constructor(private api: ApiService) {}

  getComandas() {
    return this.api.get<Comanda[]>('/api/cocina/comandas');
  }

  updateEstado(id: number, id_estado: number) {
    const map: Record<number, string> = {
      1: 'Pendiente',
      2: 'En Preparación',
      3: 'Listo',
      4: 'Servido'
    };
    const nombre = map[id_estado] || 'Pendiente';
    return this.api.patch<any>(`/api/cocina/comandas/${id}/estado`, {
      id_estado,
      estado: nombre
    });
  }
}
