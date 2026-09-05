import { Component, signal, computed, inject, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { ThemeService } from '../../core/services/theme.service';

interface GridDot {
  gridX: number;
  gridY: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  size: number;
  baseSize: number;
  opacity: number;
  baseOpacity: number;
  phaseX: number;
  phaseY: number;
  speed: number;
  isAccent: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('dotCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private auth = inject(AuthService);
  private router = inject(Router);
  private alert = inject(AlertService);
  themeService = inject(ThemeService);

  isDark = computed(() => this.themeService.isDark());

  email = '';
  password = '';
  loading = signal(false);
  showPwd = signal(false);

  private animationFrameId?: number;
  private mouse = { x: -2000, y: -2000 };
  private resizeHandler?: () => void;

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  ngAfterViewInit() {
    this.initDotMatrixCanvas();
  }

  private initDotMatrixCanvas() {
    if (typeof window === 'undefined' || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    let dots: GridDot[] = [];
    const spacing = 26; // Grid gap

    const buildGrid = () => {
      dots = [];
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gx = c * spacing;
          const gy = r * spacing;
          dots.push({
            gridX: gx,
            gridY: gy,
            originX: gx,
            originY: gy,
            x: gx,
            y: gy,
            baseSize: 1.3,
            size: 1.3,
            baseOpacity: 0.14,
            opacity: 0.14,
            phaseX: Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.0008 + 0.0012,
            isAccent: false
          });
        }
      }
    };

    this.resizeHandler = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      buildGrid();
    };
    window.addEventListener('resize', this.resizeHandler);
    buildGrid();

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      const mouseRadius = 95;

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];

        // 1. Subtle natural wave motion & breathing
        const waveX = Math.sin(time * d.speed + d.phaseX) * 2.8;
        const waveY = Math.cos(time * d.speed * 0.9 + d.phaseY) * 2.8;
        const targetOriginX = d.gridX + waveX;
        const targetOriginY = d.gridY + waveY;
        d.originX += (targetOriginX - d.originX) * 0.1;
        d.originY += (targetOriginY - d.originY) * 0.1;

        // Subtle breathing opacity
        const breath = Math.sin(time * 0.0018 + d.phaseX) * 0.035;
        const currentBaseOpacity = Math.max(0.08, d.baseOpacity + breath);

        // 2. Mouse distance & physics
        const dx = this.mouse.x - d.originX;
        const dy = this.mouse.y - d.originY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouseRadius) {
          // Repulsion force & illumination
          const force = (1 - dist / mouseRadius);
          const angle = Math.atan2(dy, dx);
          
          const targetX = d.originX - Math.cos(angle) * force * 16;
          const targetY = d.originY - Math.sin(angle) * force * 16;

          d.x += (targetX - d.x) * 0.22;
          d.y += (targetY - d.y) * 0.22;
          d.size = d.baseSize + force * 1.8;
          d.opacity = currentBaseOpacity + force * 0.78;
          d.isAccent = true;
        } else {
          // Smooth spring return to undulating origin coordinate
          d.x += (d.originX - d.x) * 0.12;
          d.y += (d.originY - d.y) * 0.12;
          d.size += (d.baseSize - d.size) * 0.12;
          d.opacity += (currentBaseOpacity - d.opacity) * 0.08;
          d.isAccent = d.opacity > 0.26;
        }

        // Draw crisp dot
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        if (d.isAccent) {
          ctx.fillStyle = `rgba(52, 211, 153, ${d.opacity})`; // Emerald react
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${d.opacity})`; // Crisp white dot
        }
        ctx.fill();
      }

      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  onBannerMouseMove(e: MouseEvent) {
    if (!this.canvasRef) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  }

  onBannerMouseLeave() {
    this.mouse.x = -2000;
    this.mouse.y = -2000;
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

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
          Mesero: '/mesas',
          Cocinero: '/cocina',
          Cajero: '/caja'
        };
        setTimeout(() => {
          this.router.navigate([map[role] ?? '/mesas']);
        }, 300);
      },
      error: (e) => {
        console.error('Error login detallado:', e);
        const detailedMsg = e.error?.message || (e.status === 401 ? 'Credenciales incorrectas (verifica correo y contraseña)' : `Error HTTP ${e.status}: ${e.statusText || 'No se pudo comunicar con el backend'}`);
        this.alert.error('Error de Acceso', detailedMsg);
        this.loading.set(false);
      }
    });
  }
}
