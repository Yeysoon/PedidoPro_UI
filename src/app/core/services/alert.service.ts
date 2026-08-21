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
    background: '#181411',
    color: '#F5F0EB',
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
    customClass: {
      popup: 'swal-dark-popup'
    }
  });

  successToast(title: string) {
    return this.toastConfig.fire({
      icon: 'success',
      title,
      iconColor: '#4CAF82'
    });
  }

  errorToast(title: string) {
    return this.toastConfig.fire({
      icon: 'error',
      title,
      iconColor: '#E05252'
    });
  }

  warningToast(title: string) {
    return this.toastConfig.fire({
      icon: 'warning',
      title,
      iconColor: '#E5A93C'
    });
  }

  infoToast(title: string) {
    return this.toastConfig.fire({
      icon: 'info',
      title,
      iconColor: '#5B9BD5'
    });
  }

  success(title: string, text?: string) {
    return Swal.fire({
      title,
      text,
      icon: 'success',
      iconColor: '#4CAF82',
      background: '#181411',
      color: '#F5F0EB',
      confirmButtonColor: '#C5A059',
      confirmButtonText: 'Aceptar',
      customClass: { popup: 'swal-modal-dark' }
    });
  }

  error(title: string, text?: string) {
    return Swal.fire({
      title,
      text,
      icon: 'error',
      iconColor: '#E05252',
      background: '#181411',
      color: '#F5F0EB',
      confirmButtonColor: '#C5A059',
      confirmButtonText: 'Aceptar',
      customClass: { popup: 'swal-modal-dark' }
    });
  }

  confirm(title: string, text?: string, confirmText = 'Sí, continuar') {
    return Swal.fire({
      title,
      text,
      icon: 'warning',
      iconColor: '#E5A93C',
      showCancelButton: true,
      confirmButtonColor: '#C5A059',
      cancelButtonColor: '#2C2723',
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      background: '#181411',
      color: '#F5F0EB',
      customClass: { popup: 'swal-modal-dark' }
    }).then(r => r.isConfirmed);
  }
}
