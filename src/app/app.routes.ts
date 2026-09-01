import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./shared/layout/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [roleGuard], data: { roles: ['Administrador', 'Mesero', 'Cocinero', 'Cajero'] } },
      { path: 'mesas',     loadComponent: () => import('./pages/mesas/mesas.component').then(m => m.MesasComponent),            canActivate: [roleGuard], data: { roles: ['Mesero','Administrador'] } },
      { path: 'menu',      loadComponent: () => import('./pages/menu/menu.component').then(m => m.MenuComponent),               canActivate: [roleGuard], data: { roles: ['Mesero','Cajero','Administrador'] } },
      { path: 'pedidos',   loadComponent: () => import('./pages/pedidos/pedidos.component').then(m => m.PedidosComponent),      canActivate: [roleGuard], data: { roles: ['Mesero','Administrador'] } },
      { path: 'cocina',    loadComponent: () => import('./pages/cocina/cocina.component').then(m => m.CocinaComponent),         canActivate: [roleGuard], data: { roles: ['Cocinero','Administrador'] } },
      { path: 'caja',      loadComponent: () => import('./pages/caja/caja.component').then(m => m.CajaComponent),               canActivate: [roleGuard], data: { roles: ['Cajero','Administrador'] } },
      { path: 'clientes',  loadComponent: () => import('./pages/clientes/clientes.component').then(m => m.ClientesComponent),   canActivate: [roleGuard], data: { roles: ['Cajero','Administrador'] } },
      { path: 'usuarios',  loadComponent: () => import('./pages/usuarios/usuarios.component').then(m => m.UsuariosComponent),   canActivate: [roleGuard], data: { roles: ['Administrador'] } },
      { path: 'inventario',loadComponent: () => import('./pages/inventario/inventario.component').then(m => m.InventarioComponent), canActivate: [roleGuard], data: { roles: ['Administrador','Cocinero'] } },
      { path: 'reportes',  loadComponent: () => import('./pages/reportes/reportes.component').then(m => m.ReportesComponent),   canActivate: [roleGuard], data: { roles: ['Administrador'] } },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
