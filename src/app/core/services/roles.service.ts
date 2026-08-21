import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Rol, Permiso } from '../models';

@Injectable({ providedIn: 'root' })
export class RolesService {
  constructor(private api: ApiService) {}
  getRoles()                           { return this.api.get<Rol[]>('/api/roles'); }
  createRol(d: Partial<Rol>)           { return this.api.post<Rol>('/api/roles', d); }
  updateRol(id: number, d: Partial<Rol>) { return this.api.put<Rol>(`/api/roles/${id}`, d); }
  deleteRol(id: number)                { return this.api.delete<any>(`/api/roles/${id}`); }
  getPermisos()                        { return this.api.get<Permiso[]>('/api/roles/permisos/lista'); }
  getPermisosRol(id: number)           { return this.api.get<Permiso[]>(`/api/roles/${id}/permisos`); }
  assignPermisos(id: number, ids: number[]) { return this.api.post<any>(`/api/roles/${id}/permisos`, { permisos: ids }); }
}
