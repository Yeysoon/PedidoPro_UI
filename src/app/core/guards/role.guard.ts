import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const roles: string[] = route.data['roles'] ?? [];
  if (!auth.isLoggedIn()) { router.navigate(['/login']); return false; }
  if (roles.length && !auth.hasRole(roles)) {
    const userRole = auth.getRole();
    const isCocinero = userRole === 'Cocinero' || userRole === 'Cocina';
    const target = isCocinero ? '/cocina' : (userRole === 'Cajero' ? '/caja' : (userRole === 'Mesero' ? '/mesas' : '/dashboard'));
    
    const currentPath = route.routeConfig?.path || '';
    if (target.replace('/', '') === currentPath) {
      router.navigate(['/login']);
    } else {
      router.navigate([target]);
    }
    return false;
  }
  return true;
};
