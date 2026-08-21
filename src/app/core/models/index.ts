// =============================================
// PEDIDOPRO — TypeScript Models / Interfaces
// =============================================

export interface LoginRequest { email: string; password: string; }
export interface AuthResponse  { token: string; usuario: Usuario; }

export interface Usuario {
  id_usuario: number;
  nombre_rol?: string;
  nombre: string;
  email: string;
  activo: boolean;
  rol: string;
  id_rol: number;
}

export interface Rol { id_rol: number; nombre_rol: string; }
export interface Permiso { id_permiso: number; nombre_permiso: string; descripcion?: string; }

export interface Zona { id_zona: number; nombre_zona: string; }
export interface Mesa {
  id_mesa: number;
  id_zona: number;
  numero_mesa: number;
  capacidad: number;
  estado: 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento';
  nombre_zona?: string;
}

export interface Categoria { id_categoria: number; nombre_categoria: string; }
export interface Producto {
  id_producto: number;
  id_categoria: number;
  nombre_producto: string;
  descripcion?: string;
  precio: number;
  disponible: boolean;
  nombre_categoria?: string;
}

export interface Ingrediente {
  id_ingrediente: number;
  nombre_ingrediente: string;
  unidad_medida: string;
  stock_actual: number;
}
export interface RecetaItem { id_ingrediente: number; nombre_ingrediente?: string; cantidad_necesaria: number; }

export interface EstadoPedido { id_estado: number; nombre_estado: string; }
export interface DetallePedido {
  id_detalle?: number;
  id_producto: number;
  cantidad: number;
  precio_unitario_historico?: number;
  notas_especiales?: string;
  nombre_producto?: string;
}
export interface Pedido {
  id_pedido: number;
  id_mesa: number;
  id_usuario_mesero: number;
  id_estado: number;
  fecha_hora_creacion: string;
  notas_generales?: string;
  nombre_estado?: string;
  numero_mesa?: number;
  nombre_mesero?: string;
  detalles?: DetallePedido[];
}

export interface Comanda {
  id_pedido: number;
  numero_mesa: number;
  id_estado: number;
  nombre_estado: string;
  fecha_hora_creacion: string;
  notas_generales?: string;
  detalles: DetallePedido[];
}

export interface Cliente {
  id_cliente: number;
  nit_documento?: string;
  nombre_completo: string;
  correo_electronico?: string;
  telefono?: string;
}

export interface MetodoPago { id_metodo: number; nombre_metodo: string; }
export interface Factura {
  id_factura: number;
  id_pedido: number;
  id_cliente?: number;
  id_usuario_cajero: number;
  id_metodo_pago: number;
  subtotal: number;
  impuestos: number;
  total_pagado: number;
  propina: number;
  fecha_hora_pago: string;
}
export interface FacturarRequest {
  id_pedido: number;
  id_cliente?: number;
  id_metodo_pago: number;
  propina?: number;
}

export interface VentaReporte { fecha: string; total_ventas: number; cantidad_facturas: number; }
export interface ProductoTop   { nombre_producto: string; total_vendido: number; }

export interface ApiResponse<T> { data?: T; message?: string; error?: string; }

export interface SidebarItem {
  label: string;
  icon: string;
  route: string;
  roles: string[];
}

