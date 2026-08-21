import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UsuariosService } from '../../core/services/usuarios.service';
import { RolesService } from '../../core/services/roles.service';
import { AlertService } from '../../core/services/alert.service';
import { Usuario, Rol } from '../../core/models';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss'
})
export class UsuariosComponent implements OnInit {
  usuarios  = signal<Usuario[]>([]);
  roles     = signal<Rol[]>([]);
  loading   = signal(true);
  saving    = signal(false);
  showModal = signal(false);
  isEdit    = signal(false);
  editItem  = signal<any>({});

  constructor(
    private svc: UsuariosService,
    private rolesSvc: RolesService,
    private alert: AlertService
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc.getUsuarios().subscribe({
      next: u => {
        this.usuarios.set(u);
        this.loading.set(false);
      },
      error: e => {
        this.alert.error('Error al cargar usuarios', e.error?.message);
        this.loading.set(false);
      }
    });

    this.rolesSvc.getRoles().subscribe({
      next: r => this.roles.set(r),
      error: () => {}
    });
  }

  openCreate() {
    this.editItem.set({
      nombre: '',
      email: '',
      password: '',
      id_rol: this.roles()[0]?.id_rol || 1,
      activo: 1
    });
    this.isEdit.set(false);
    this.showModal.set(true);
  }

  openEdit(u: any) {
    this.editItem.set({
      id_usuario: u.id_usuario,
      nombre: u.nombre,
      email: u.email,
      id_rol: u.id_rol || this.roles().find(r => r.nombre_rol === u.nombre_rol)?.id_rol || 1,
      activo: u.activo
    });
    this.isEdit.set(true);
    this.showModal.set(true);
  }

  save() {
    const d = this.editItem();
    if (!d.nombre?.trim() || !d.email?.trim()) {
      this.alert.warningToast('Ingresa el nombre y correo');
      return;
    }
    if (!this.isEdit() && !d.password?.trim()) {
      this.alert.warningToast('Ingresa una contraseña para el usuario');
      return;
    }

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.svc.updateUsuario(d.id_usuario, {
          nombre: d.nombre,
          email: d.email,
          id_rol: +d.id_rol
        })
      : this.svc.createUsuario({
          nombre: d.nombre,
          email: d.email,
          password: d.password,
          id_rol: +d.id_rol
        });

    obs.subscribe({
      next: () => {
        this.alert.successToast(this.isEdit() ? 'Usuario actualizado' : 'Usuario creado exitosamente');
        this.showModal.set(false);
        this.saving.set(false);
        this.load();
      },
      error: e => {
        this.alert.error('Error al guardar', e.error?.message || 'No se pudo guardar el usuario');
        this.saving.set(false);
      }
    });
  }

  async toggle(u: Usuario) {
    const nuevoEstado = !u.activo;
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    const ok = await this.alert.confirm(
      `¿Deseas ${accion} al usuario?`,
      `El usuario ${u.nombre} quedará ${nuevoEstado ? 'activo' : 'inactivo'}.`,
      `Sí, ${accion}`
    );

    if (!ok) return;

    this.svc.toggleUser(u.id_usuario, nuevoEstado).subscribe({
      next: () => {
        this.alert.successToast(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'}`);
        this.load();
      },
      error: e => this.alert.error('Error al cambiar estado', e.error?.message)
    });
  }

  updateField(f: string, v: any) {
    this.editItem.update(i => ({ ...i, [f]: v }));
  }

  getRolNombre(u: Usuario) {
    if (u.nombre_rol) return u.nombre_rol;
    if (u.rol) return u.rol;
    return this.roles().find(r => r.id_rol === u.id_rol)?.nombre_rol ?? 'Usuario';
  }
}
