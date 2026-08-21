import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  email    = 'admin@pedidopro.com';
  password = 'admin123';
  loading  = signal(false);
  showPwd  = signal(false);

  constructor(
    private auth: AuthService,
    private router: Router,
    private alert: AlertService
  ) {}

  onSubmit() {
    if (!this.email || !this.password) {
      this.alert.warningToast('Ingresa tu correo y contraseña');
      return;
    }
    this.loading.set(true);

    this.auth.login({ email: this.email.trim(), password: this.password.trim() }).subscribe({
      next: () => {
        this.alert.successToast('¡Bienvenido a PedidoPro!');
        const role = this.auth.getRole();
        const map: Record<string, string> = {
          Administrador: '/dashboard',
          Mesero:        '/mesas',
          Cocinero:      '/cocina',
          Cajero:        '/caja'
        };
        setTimeout(() => {
          this.router.navigate([map[role] ?? '/mesas']);
        }, 300);
      },
      error: (e) => {
        console.error('Error login:', e);
        const msg = e.error?.message || (e.status === 0 ? 'No se pudo conectar con el servidor (puerto 3000)' : 'Credenciales incorrectas');
        this.alert.error('Error de Acceso', msg);
        this.loading.set(false);
      }
    });
  }
}
