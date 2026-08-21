import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Usuario } from '../models';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  constructor(private api: ApiService) {}
  getUsuarios()                     { return this.api.get<Usuario[]>('/api/usuarios'); }
  getUsuario(id: number)            { return this.api.get<Usuario>(`/api/usuarios/${id}`); }
  createUsuario(d: any)             { return this.api.post<Usuario>('/api/usuarios', d); }
  updateUsuario(id: number, d: any) { return this.api.put<Usuario>(`/api/usuarios/${id}`, d); }
  toggleUser(id: number, activo?: boolean) { return this.api.patch<any>(`/api/usuarios/${id}/estado`, { activo }); }
}
