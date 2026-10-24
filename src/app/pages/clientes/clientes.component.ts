import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClientesService } from '../../core/services/clientes.service';
import { AlertService } from '../../core/services/alert.service';
import { Cliente } from '../../core/models';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.scss'
})
export class ClientesComponent implements OnInit {
  clientes   = signal<Cliente[]>([]);
  loading    = signal(true);
  showModal  = signal(false);
  isEdit     = signal(false);
  editItem   = signal<Partial<Cliente>>({});
  search     = signal('');

  filtered = () => {
    const s = this.search().toLowerCase();
    return s
      ? this.clientes().filter(c => c.nombre_completo.toLowerCase().includes(s) || (c.nit_documento ?? '').includes(s))
      : this.clientes();
  };

  constructor(
    private svc: ClientesService,
    private alert: AlertService
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc.getClientes().subscribe({
      next: c => { this.clientes.set(c); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openCreate() {
    this.editItem.set({
      nombre_completo: '',
      nit_documento: ''
    });
    this.isEdit.set(false);
    this.showModal.set(true);
  }

  openEdit(c: Cliente) {
    this.editItem.set({ ...c });
    this.isEdit.set(true);
    this.showModal.set(true);
  }

  onNombreKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length === 1 && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  onNombreInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value || '';
    const filtered = raw.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '').slice(0, 60);
    if (input.value !== filtered) {
      input.value = filtered;
    }
    this.update('nombre_completo', filtered);
  }

  onNitKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length === 1 && !/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  onNitInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value || '';
    const filtered = raw.replace(/\D/g, '').slice(0, 13);
    if (input.value !== filtered) {
      input.value = filtered;
    }
    this.update('nit_documento', filtered);
  }

  save() {
    const d = this.editItem();
    const nombre = (d.nombre_completo || '').trim();
    const nit = (d.nit_documento || '').trim();

    if (!nombre) {
      this.alert.warningToast('Ingresa el nombre del cliente');
      return;
    }

    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!nameRegex.test(nombre)) {
      this.alert.warningToast('El nombre solo debe contener letras del abecedario');
      return;
    }

    if (nit) {
      if (!/^\d+$/.test(nit)) {
        this.alert.warningToast('El NIT solo debe contener dígitos numéricos');
        return;
      }
      const validLengths = [7, 8, 9, 13];
      if (!validLengths.includes(nit.length)) {
        this.alert.warningToast('El NIT debe contener únicamente 7, 8, 9 o 13 dígitos');
        return;
      }
    }

    const payload: Partial<Cliente> = {
      ...d,
      nombre_completo: nombre,
      nit_documento: nit || undefined
    };

    const obs = this.isEdit()
      ? this.svc.updateCliente(d.id_cliente!, payload)
      : this.svc.createCliente(payload);

    obs.subscribe({
      next: () => {
        this.alert.successToast(this.isEdit() ? 'Cliente actualizado' : 'Cliente registrado');
        this.showModal.set(false);
        this.load();
      },
      error: e => this.alert.error('Error al guardar', e.error?.message)
    });
  }

  async delete(id: number) {
    const ok = await this.alert.confirm('¿Eliminar cliente?', 'Se eliminarán sus datos del directorio.', 'Sí, eliminar');
    if (!ok) return;

    this.svc.deleteCliente(id).subscribe({
      next: () => {
        this.alert.successToast('Cliente eliminado');
        this.load();
      },
      error: e => this.alert.error('Error al eliminar', e.error?.message)
    });
  }

  update(f: string, v: any) {
    this.editItem.update(i => ({ ...i, [f]: v }));
  }
}
