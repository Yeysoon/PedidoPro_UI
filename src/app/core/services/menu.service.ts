import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Producto, Categoria } from '../models';

@Injectable({ providedIn: 'root' })
export class MenuService {
  constructor(private api: ApiService) {}
  getMenu()                                  { return this.api.get<Producto[]>('/api/menu'); }
  getCategorias()                            { return this.api.get<Categoria[]>('/api/menu/categorias'); }
  createProducto(data: Partial<Producto>)    { return this.api.post<Producto>('/api/menu/productos', data); }
  updateProducto(id: number, d: Partial<Producto>) { return this.api.put<Producto>(`/api/menu/productos/${id}`, d); }
  deleteProducto(id: number)                 { return this.api.delete<any>(`/api/menu/productos/${id}`); }
  createCategoria(data: Partial<Categoria>)  { return this.api.post<Categoria>('/api/menu/categorias', data); }
  updateCategoria(id: number, d: Partial<Categoria>) { return this.api.put<Categoria>(`/api/menu/categorias/${id}`, d); }
  deleteCategoria(id: number)                { return this.api.delete<any>(`/api/menu/categorias/${id}`); }
}
