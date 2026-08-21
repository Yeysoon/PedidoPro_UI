import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { VentaReporte, ProductoTop } from '../models';

@Injectable({ providedIn: 'root' })
export class ReportesService {
  constructor(private api: ApiService) {}
  getVentas()        { return this.api.get<VentaReporte[]>('/api/reportes/ventas'); }
  getProductosTop()  { return this.api.get<ProductoTop[]>('/api/reportes/productos-top'); }
}
