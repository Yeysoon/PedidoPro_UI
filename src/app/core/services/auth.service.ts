import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { LoginRequest, Usuario } from '../models';
import { environment } from '../../../environments/environment';

interface BackendAuthResponse {
  token: string;
  user: {
    id: number;
    nombre: string;
    email: string;
    rol: string;
  };
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'pp_token';
  private readonly USER_KEY  = 'pp_user';
  private baseUrl = environment.apiUrl;

  currentUser = signal<Usuario | null>(this.loadUser());
  isLoggedIn  = signal<boolean>(!!this.getToken());

  constructor(private http: HttpClient, private router: Router) {}

  normalizeRole(rawRole?: string | null): string {
    if (!rawRole) return '';
    const r = rawRole.trim().toLowerCase();
    if (r === 'cocina' || r === 'cocinero' || r === 'chef') return 'Cocinero';
    if (r === 'admin' || r === 'administrador') return 'Administrador';
    if (r === 'mesero' || r === 'mozo') return 'Mesero';
    if (r === 'cajero' || r === 'caja') return 'Cajero';
    return rawRole.trim();
  }

  login(body: LoginRequest) {
    const url = `${this.baseUrl}/api/auth/login`;
    return this.http.post<BackendAuthResponse>(url, body).pipe(
      tap(res => {
        const normalizedRole = this.normalizeRole(res.user?.rol);
        const usuario: Usuario = {
          id_usuario: res.user.id,
          nombre:     res.user.nombre,
          email:      res.user.email,
          rol:        normalizedRole,
          activo:     true,
          id_rol:     0
        };
        localStorage.setItem(this.TOKEN_KEY, res.token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(usuario));
        this.currentUser.set(usuario);
        this.isLoggedIn.set(true);
      })
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null { return localStorage.getItem(this.TOKEN_KEY); }
  getUser(): Usuario | null  { return this.currentUser(); }
  getRole(): string          { return this.normalizeRole(this.currentUser()?.rol); }
  hasRole(roles: string[]): boolean {
    const current = this.getRole().toLowerCase();
    if (!current) return false;
    return roles.some(r => {
      const lower = r.toLowerCase();
      if (lower === current) return true;
      if ((lower === 'cocinero' || lower === 'cocina') && (current === 'cocinero' || current === 'cocina')) return true;
      return false;
    });
  }

  private loadUser(): Usuario | null {
    try {
      const u = localStorage.getItem(this.USER_KEY);
      if (!u) return null;
      const parsed = JSON.parse(u);
      if (parsed) {
        parsed.rol = this.normalizeRole(parsed.rol);
      }
      return parsed;
    }
    catch { return null; }
  }
}
