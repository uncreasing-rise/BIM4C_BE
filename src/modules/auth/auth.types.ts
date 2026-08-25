import type { AdminRole } from '@prisma/client';
export interface AuthenticatedAdmin { id: string; email: string; name: string; roles: AdminRole[]; permissions: string[]; sessionId: string }
declare module 'express-serve-static-core' { interface Request { admin?: AuthenticatedAdmin; requestId?: string } }
