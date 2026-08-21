import { Component, computed, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { SidebarItem } from '../../core/models';

const ALL_ITEMS: SidebarItem[] = [
  { label: 'Dashboard',    icon: 'space_dashboard',   route: '/dashboard', roles: ['Administrador'] },
  { label: 'Mesas',        icon: 'table_restaurant',  route: '/mesas',     roles: ['Mesero','Administrador'] },
  { label: 'Tomar Pedido', icon: 'receipt_long',      route: '/pedidos',   roles: ['Mesero'] },
  { label: 'Menú',         icon: 'restaurant_menu',   route: '/menu',      roles: ['Mesero','Cajero','Administrador'] },
  { label: 'Cocina',       icon: 'soup_kitchen',      route: '/cocina',    roles: ['Cocinero'] },
  { label: 'Caja',         icon: 'point_of_sale',     route: '/caja',      roles: ['Cajero'] },
  { label: 'Clientes',     icon: 'groups',            route: '/clientes',  roles: ['Cajero','Administrador'] },
  { label: 'Usuarios',     icon: 'manage_accounts',   route: '/usuarios',  roles: ['Administrador'] },
  { label: 'Inventario',   icon: 'inventory_2',       route: '/inventario',roles: ['Administrador','Cocinero'] },
  { label: 'Reportes',     icon: 'analytics',         route: '/reportes',  roles: ['Administrador'] },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  sidebarOpen = signal(true);
  user = computed(() => this.auth.currentUser());
  role = computed(() => this.auth.getRole());

  navItems = computed(() =>
    ALL_ITEMS.filter(i => i.roles.includes(this.auth.getRole()))
  );

  constructor(
    private auth: AuthService,
    private alert: AlertService
  ) {}

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  async logout() {
    const ok = await this.alert.confirm('¿Cerrar sesión?', 'Saldrás de tu sesión actual en PedidoPro.', 'Sí, salir');
    if (ok) {
      this.auth.logout();
    }
  }

  getRoleIcon(): string {
    const map: Record<string, string> = {
      'Administrador': 'admin_panel_settings',
      'Mesero':        'room_service',
      'Cocinero':      'soup_kitchen',
      'Cajero':        'payments'
    };
    return map[this.role()] ?? 'person';
  }
}
