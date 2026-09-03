import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '@prisma/client';

export const ADMIN_RESOURCE = 'adminResource';
export const AdminResource = (resource: string) =>
  SetMetadata(ADMIN_RESOURCE, resource);
const editorResources = [
  'projects',
  'services',
  'courses',
  'posts',
  'project-categories',
  'post-categories',
  'media',
  'homepage',
];
const editorPermissions = [
  ...editorResources.flatMap((resource) =>
    ['read', 'create', 'update', 'delete', 'publish', 'archive'].map(
      (action) => `${resource}.${action}`,
    ),
  ),
  'dashboard.read',
  'contacts.read',
  'contacts.update',
  'course-registrations.read',
  'course-registrations.update',
  'newsletter.read',
  'newsletter.update',
];
export function permissionsFor(roles: AdminRole[]): string[] {
  if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) return ['*'];
  return roles.includes('EDITOR') ? editorPermissions : [];
}
export function hasPermission(
  permissions: string[],
  permission: string,
): boolean {
  return permissions.includes('*') || permissions.includes(permission);
}
