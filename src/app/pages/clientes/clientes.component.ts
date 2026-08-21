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
    this.editItem.set({});
    this.isEdit.set(false);
    this.showModal.set(true);
  }

  openEdit(c: Cliente) {
    this.editItem.set({ ...c });
    this.isEdit.set(true);
    this.showModal.set(true);
  }

  save() {
    const d = this.editItem();
    if (!d.nombre_completo?.trim()) {
      this.alert.warningToast('Ingresa el nombre del cliente');
      return;
    }
    const obs = this.isEdit()
      ? this.svc.updateCliente(d.id_cliente!, d)
      : this.svc.createCliente(d);

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
