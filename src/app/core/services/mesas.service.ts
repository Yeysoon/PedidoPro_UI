import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Mesa, Zona } from '../models';

@Injectable({ providedIn: 'root' })
export class MesasService {
  constructor(private api: ApiService) {}
  getMesas()                          { return this.api.get<Mesa[]>('/api/mesas'); }
  getZonas()                          { return this.api.get<Zona[]>('/api/mesas/zonas/lista'); }
  updateEstado(id: number, estado: string) { return this.api.put<any>(`/api/mesas/${id}/estado`, { estado }); }
  createMesa(data: Partial<Mesa>)     { return this.api.post<Mesa>('/api/mesas', data); }
  updateMesa(id: number, data: Partial<Mesa>) { return this.api.put<Mesa>(`/api/mesas/${id}`, data); }
  deleteMesa(id: number)              { return this.api.delete<any>(`/api/mesas/${id}`); }
  createZona(data: Partial<Zona>)     { return this.api.post<Zona>('/api/mesas/zonas', data); }
  updateZona(id: number, data: Partial<Zona>) { return this.api.put<Zona>(`/api/mesas/zonas/${id}`, data); }
  deleteZona(id: number)              { return this.api.delete<any>(`/api/mesas/zonas/${id}`); }
}
