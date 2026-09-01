import { Component, computed, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { ThemeService } from '../../core/services/theme.service';
import { SidebarItem } from '../../core/models';

const ALL_ITEMS: SidebarItem[] = [
  { label: 'Dashboard',    icon: 'pi pi-th-large',    route: '/dashboard', roles: ['Administrador', 'Mesero', 'Cocinero', 'Cajero'] },
  { label: 'Mesas / Salón',icon: 'pi pi-table',       route: '/mesas',     roles: ['Mesero', 'Administrador'] },
  { label: 'Tomar Pedido', icon: 'pi pi-shopping-bag',route: '/pedidos',   roles: ['Mesero', 'Administrador'] },
  { label: 'Menú',         icon: 'pi pi-book',        route: '/menu',      roles: ['Mesero', 'Cajero', 'Administrador'] },
  { label: 'Cocina',       icon: 'pi pi-bell',        route: '/cocina',    roles: ['Cocinero', 'Administrador'] },
  { label: 'Caja y Cobro', icon: 'pi pi-credit-card', route: '/caja',      roles: ['Cajero', 'Administrador'] },
  { label: 'Clientes',     icon: 'pi pi-users',       route: '/clientes',  roles: ['Cajero', 'Administrador'] },
  { label: 'Usuarios / Roles', icon: 'pi pi-user',    route: '/usuarios',  roles: ['Administrador'] },
  { label: 'Inventario',   icon: 'pi pi-box',         route: '/inventario',roles: ['Administrador', 'Cocinero'] },
  { label: 'Reportes',     icon: 'pi pi-chart-bar',   route: '/reportes',  roles: ['Administrador'] },
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
  themeService = inject(ThemeService);
  auth = inject(AuthService);
  alert = inject(AlertService);

  user = computed(() => this.auth.currentUser());
  role = computed(() => this.auth.getRole());
  isDark = computed(() => this.themeService.isDark());

  navItems = computed(() =>
    ALL_ITEMS.filter(i => i.roles.includes(this.auth.getRole()))
  );

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  async logout() {
    const ok = await this.alert.confirm('¿Cerrar sesión?', 'Saldrás de tu sesión actual en PedidoPro.', 'Sí, salir');
    if (ok) {
      this.auth.logout();
    }
  }

  getRoleIcon(): string {
    const map: Record<string, string> = {
      'Administrador': 'pi pi-shield',
      'Mesero':        'pi pi-user',
      'Cocinero':      'pi pi-bell',
      'Cajero':        'pi pi-credit-card'
    };
    return map[this.role()] ?? 'pi pi-user';
  }

  getUserInitials(): string {
    const name = this.user()?.nombre || 'User';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
}
