import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from './config.js';

// Prisma returns BigInt for BIGINT columns; make JSON.stringify safe.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) { return Number(this); };

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL }) });
export type Tx = Prisma.TransactionClient;
export type DbRole = 'SUPER_ADMIN' | 'SUPPLIER_ADMIN' | 'SUPPLIER_STAFF' | 'SYSTEM';

export interface DbContext { role: DbRole; supplierId: string | null }

/**
 * Runs fn inside ONE transaction with the row level security context set.
 * set_config(..., true) is transaction-local, so it is safe with pooled connections.
 * Without it the database returns no tenant rows at all (fails closed).
 */
export async function withDb<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.role', ${ctx.role}, true), set_config('app.supplier_id', ${ctx.supplierId ?? ''}, true)`;
    return fn(tx);
  }, { timeout: 30000, maxWait: 10000 });
}

/** Auth service only (login, refresh, reset), before a tenant is known. */
export const withSystem = <T>(fn: (tx: Tx) => Promise<T>) => withDb({ role: 'SYSTEM', supplierId: null }, fn);
