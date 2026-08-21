import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const roles: string[] = route.data['roles'] ?? [];
  if (!auth.isLoggedIn()) { router.navigate(['/login']); return false; }
  if (roles.length && !auth.hasRole(roles)) { router.navigate(['/dashboard']); return false; }
  return true;
};
