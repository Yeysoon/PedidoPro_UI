import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Ingrediente, RecetaItem } from '../models';

@Injectable({ providedIn: 'root' })
export class InventarioService {
  constructor(private api: ApiService) {}
  getIngredientes()                                   { return this.api.get<Ingrediente[]>('/api/inventario/ingredientes'); }
  createIngrediente(d: Partial<Ingrediente>)          { return this.api.post<Ingrediente>('/api/inventario/ingredientes', d); }
  updateIngrediente(id: number, d: Partial<Ingrediente>) { return this.api.put<Ingrediente>(`/api/inventario/ingredientes/${id}`, d); }
  deleteIngrediente(id: number)                       { return this.api.delete<any>(`/api/inventario/ingredientes/${id}`); }
  getReceta(id_producto: number)                      { return this.api.get<RecetaItem[]>(`/api/inventario/recetas/${id_producto}`); }
  saveReceta(id_producto: number, items: RecetaItem[]) { return this.api.post<any>(`/api/inventario/recetas/${id_producto}`, { ingredientes: items }); }
}
