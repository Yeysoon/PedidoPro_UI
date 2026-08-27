import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class AlertService {
  private toastConfig = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
    customClass: {
      popup: 'swal-pedidopro-toast'
    }
  });

  successToast(title: string) {
    return this.toastConfig.fire({
      icon: 'success',
      title
    });
  }

  errorToast(title: string) {
    return this.toastConfig.fire({
      icon: 'error',
      title
    });
  }

  warningToast(title: string) {
    return this.toastConfig.fire({
      icon: 'warning',
      title
    });
  }

  infoToast(title: string) {
    return this.toastConfig.fire({
      icon: 'info',
      title
    });
  }

  success(title: string, text?: string) {
    return Swal.fire({
      title,
      text,
      icon: 'success',
      confirmButtonText: 'Aceptar',
      customClass: {
        popup: 'swal-pedidopro-modal',
        confirmButton: 'btn btn-primary'
      },
      buttonsStyling: false
    });
  }

  error(title: string, text?: string) {
    return Swal.fire({
      title,
      text,
      icon: 'error',
      confirmButtonText: 'Entendido',
      customClass: {
        popup: 'swal-pedidopro-modal',
        confirmButton: 'btn btn-primary'
      },
      buttonsStyling: false
    });
  }

  confirm(title: string, text?: string, confirmText = 'Sí, salir') {
    return Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: {
        popup: 'swal-pedidopro-modal',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-ghost'
      },
      buttonsStyling: false
    }).then(r => r.isConfirmed);
  }
}
