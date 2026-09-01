import { Component, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UsuariosService } from '../../core/services/usuarios.service';
import { RolesService } from '../../core/services/roles.service';
import { AlertService } from '../../core/services/alert.service';
import { Usuario, Rol, Permiso } from '../../core/models';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss'
})
export class UsuariosComponent implements OnInit {
  private svc = inject(UsuariosService);
  private rolesSvc = inject(RolesService);
  private alert = inject(AlertService);

  activeTab = signal<'usuarios' | 'roles'>('usuarios');

  usuarios   = signal<Usuario[]>([]);
  roles      = signal<Rol[]>([]);
  permisos   = signal<Permiso[]>([]);
  loading    = signal(true);
  saving     = signal(false);

  // Modal Usuario
  showModal = signal(false);
  isEdit    = signal(false);
  editItem  = signal<any>({});

  // Modal Rol & Permisos
  showRolModal = signal(false);
  isEditRol    = signal(false);
  editRol      = signal<{ id_rol?: number; nombre_rol: string; permisos: number[] }>({ nombre_rol: '', permisos: [] });

  // Modal Cambiar Contraseña
  showPasswordModal = signal(false);
  pwdUser           = signal<Usuario | null>(null);
  newPasswordText   = '';
  showPwdText       = signal(false);
  savingPwd         = signal(false);

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

    this.rolesSvc.getPermisos().subscribe({
      next: (p: any) => {
        const list = Array.isArray(p) ? p : (p?.data || []);
        this.permisos.set(list);
      },
      error: () => {}
    });
  }

  // --- GESTIÓN DE USUARIOS ---
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
      error: (e: any) => {
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

  // --- GESTIÓN DE ROLES Y PERMISOS ---
  openCreateRol() {
    this.editRol.set({ nombre_rol: '', permisos: [] });
    this.isEditRol.set(false);
    this.showRolModal.set(true);
  }

  openEditRol(r: Rol) {
    this.rolesSvc.getPermisosRol(r.id_rol).subscribe({
      next: (p: any) => {
        const list = Array.isArray(p) ? p : (p?.data || []);
        const ids = list.map((x: any) => x.id_permiso);
        this.editRol.set({ id_rol: r.id_rol, nombre_rol: r.nombre_rol, permisos: ids });
        this.isEditRol.set(true);
        this.showRolModal.set(true);
      },
      error: () => {
        this.editRol.set({ id_rol: r.id_rol, nombre_rol: r.nombre_rol, permisos: [] });
        this.isEditRol.set(true);
        this.showRolModal.set(true);
      }
    });
  }

  togglePermiso(id: number) {
    this.editRol.update(r => {
      const exists = r.permisos.includes(id);
      return {
        ...r,
        permisos: exists ? r.permisos.filter(p => p !== id) : [...r.permisos, id]
      };
    });
  }

  saveRol() {
    const d = this.editRol();
    if (!d.nombre_rol.trim()) {
      this.alert.warningToast('Ingresa el nombre del rol');
      return;
    }

    this.saving.set(true);
    if (this.isEditRol() && d.id_rol) {
      this.rolesSvc.updateRol(d.id_rol, { nombre_rol: d.nombre_rol }).subscribe({
        next: () => {
          if (d.permisos.length >= 0) {
            this.rolesSvc.assignPermisos(d.id_rol!, d.permisos).subscribe({
              next: () => {
                this.alert.successToast('Rol y permisos actualizados');
                this.showRolModal.set(false);
                this.saving.set(false);
                this.load();
              },
              error: () => {
                this.showRolModal.set(false);
                this.saving.set(false);
                this.load();
              }
            });
          }
        },
        error: e => {
          this.alert.error('Error al actualizar rol', e.error?.message);
          this.saving.set(false);
        }
      });
    } else {
      this.rolesSvc.createRol({ nombre_rol: d.nombre_rol }).subscribe({
        next: (created: any) => {
          const newId = created?.id_rol || created?.data?.id_rol;
          if (newId && d.permisos.length > 0) {
            this.rolesSvc.assignPermisos(newId, d.permisos).subscribe(() => {});
          }
          this.alert.successToast('Rol creado exitosamente');
          this.showRolModal.set(false);
          this.saving.set(false);
          this.load();
        },
        error: e => {
          this.alert.error('Error al crear rol', e.error?.message);
          this.saving.set(false);
        }
      });
    }
  }

  async deleteRol(id: number) {
    const ok = await this.alert.confirm('¿Eliminar rol?', 'Los usuarios con este rol deberán ser reasignados.', 'Sí, eliminar');
    if (!ok) return;

    this.rolesSvc.deleteRol(id).subscribe({
      next: () => {
        this.alert.successToast('Rol eliminado');
        this.load();
      },
      error: e => this.alert.error('Error al eliminar rol', e.error?.message)
    });
  }

  // --- GESTIÓN DE CONTRASEÑA ---
  openChangePassword(u: any) {
    if (!u) return;
    const rolId = u.id_rol || this.roles().find(r => r.nombre_rol === u.nombre_rol || r.nombre_rol === u.rol)?.id_rol || 1;
    this.pwdUser.set({
      id_usuario: u.id_usuario,
      nombre: u.nombre,
      email: u.email,
      id_rol: rolId,
      activo: u.activo,
      rol: u.rol || u.nombre_rol || ''
    });
    this.newPasswordText = '';
    this.showPwdText.set(false);
    this.showPasswordModal.set(true);
  }

  generatePassword() {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*';
    const all = uppercase + lowercase + numbers + symbols;

    let pwd = '';
    pwd += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    pwd += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
    pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));

    for (let i = 4; i < 10; i++) {
      pwd += all.charAt(Math.floor(Math.random() * all.length));
    }
    pwd = pwd.split('').sort(() => 0.5 - Math.random()).join('');

    this.newPasswordText = pwd;
    this.showPwdText.set(true);
    this.alert.successToast('Contraseña sugerida generada');
  }

  copyPassword() {
    const pwd = this.newPasswordText.trim();
    if (!pwd) {
      this.alert.warningToast('Primero genera o escribe una contraseña');
      return;
    }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(pwd).then(() => {
        this.alert.successToast('Contraseña copiada al portapapeles');
      }).catch(() => {
        this.fallbackCopy(pwd);
      });
    } else {
      this.fallbackCopy(pwd);
    }
  }

  private fallbackCopy(text: string) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      this.alert.successToast('Contraseña copiada al portapapeles');
    } catch {
      this.alert.infoToast('Contraseña: ' + text);
    }
    document.body.removeChild(textArea);
  }

  savePassword() {
    const u = this.pwdUser();
    const pwd = this.newPasswordText.trim();
    if (!u || !u.id_usuario) {
      this.alert.error('Error', 'No se pudo identificar al usuario seleccionado');
      return;
    }
    if (!pwd || pwd.length < 6) {
      this.alert.warningToast('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    this.savingPwd.set(true);
    this.svc.changePassword(u.id_usuario, pwd, u).subscribe({
      next: (res: any) => {
        this.alert.success('Contraseña Actualizada', res?.message || `Se ha modificado la contraseña para ${u.nombre}.`);
        this.showPasswordModal.set(false);
        this.savingPwd.set(false);
        this.newPasswordText = '';
      },
      error: e => {
        console.error('Error al cambiar contraseña:', e);
        this.alert.error('Error al actualizar', e.error?.message || 'No se pudo cambiar la contraseña');
        this.savingPwd.set(false);
      }
    });
  }
}

