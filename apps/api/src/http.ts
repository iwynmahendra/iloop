import type { ErrorRequestHandler, Response } from 'express';
import { ZodError, z } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from './logger.js';

// Friendlier wording for the most common validation failure.
z.config({ customError: (iss) => (iss.input === undefined ? 'This field is required' : undefined) });

export class AppError extends Error {
  constructor(public status: number, message: string, public errors?: unknown) { super(message); }
}
export const badRequest = (m: string, e?: unknown) => new AppError(400, m, e);
export const unauthorized = (m = 'Authentication required') => new AppError(401, m);
export const forbidden = (m = 'You do not have permission to do this') => new AppError(403, m);
export const notFound = (m = 'Not found') => new AppError(404, m);
export const conflict = (m: string) => new AppError(409, m);

export interface Meta { page: number; limit: number; total: number }
export function ok(res: Response, data: unknown, message = 'OK', meta?: Meta, status = 200) {
  res.status(status).json({ success: true, data, message, errors: null, meta: meta ?? null });
}

function pgCode(err: unknown): { code?: string; constraint?: string; detail?: string } {
  // Prisma + driver adapter surfaces the Postgres error in several shapes depending on the version.
  const e = err as any;
  const cause = e?.meta?.driverAdapterError?.cause ?? e?.cause ?? e?.meta ?? {};
  const msg = String(e?.message ?? '');
  const code = cause.originalCode ?? cause.code ?? (/violates check constraint/.test(msg) ? '23514' : undefined);
  const constraint = cause.constraint ?? msg.match(/constraint "([^"]+)"/)?.[1];
  return { code, constraint, detail: cause.detail };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const send = (status: number, message: string, errors: unknown = null) =>
    res.status(status).json({ success: false, data: null, message, errors, meta: null });

  if (err instanceof AppError) return send(err.status, err.message, err.errors ?? null);
  if (err instanceof ZodError) {
    return send(422, 'Validation failed', err.issues.map((i) => ({ field: i.path.join('.') || (i as any).keys?.join(',') || '', message: i.message })));
  }
  if (err?.type === 'entity.parse.failed') return send(400, 'Invalid JSON body');
  if (err?.code === 'LIMIT_FILE_SIZE') return send(413, 'File is too large');
  if (err instanceof Prisma.PrismaClientKnownRequestError || err?.name === 'DriverAdapterError' || err?.name?.includes('Prisma')) {
    const { code, constraint } = pgCode(err);
    if (err.code === 'P2002' || code === '23505') return send(409, 'A record with the same unique value already exists (including deleted records: restore it instead)', { constraint: constraint ?? err.meta?.target });
    if (err.code === 'P2003' || code === '23503') return send(400, 'A referenced record does not exist or belongs to another supplier', { constraint });
    if (err.code === 'P2025') return send(404, 'Not found');
    if (code === '23514') return send(422, 'A data rule was violated', { constraint });
    if (code === '23P01') return send(409, 'This overlaps an existing record (for example rate plan dates)', { constraint });
    if (code === '42501' || /row-level security/.test(String(err.message))) return send(403, 'You do not have permission to do this');
  }
  logger.error({ err, path: req.path }, 'Unhandled error');
  return send(500, 'Internal server error');
};

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
