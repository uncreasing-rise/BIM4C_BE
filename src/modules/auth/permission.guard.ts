import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ADMIN_RESOURCE, hasPermission } from './permissions';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const resource = this.reflector.getAllAndOverride<string>(ADMIN_RESOURCE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!resource) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const action = this.action(request);
    const permission = `${resource}.${action}`;
    if (!request.admin || !hasPermission(request.admin.permissions, permission))
      throw new ForbiddenException(`Missing permission: ${permission}`);
    return true;
  }
  private action(request: Request): string {
    if (request.method === 'GET') return 'read';
    if (request.method === 'DELETE') return 'delete';
    if (request.method === 'PATCH')
      return request.path.endsWith('/status') ? 'update' : 'update';
    if (request.path.endsWith('/bulk'))
      return String((request.body as { action?: string }).action ?? 'update');
    return 'create';
  }
}
