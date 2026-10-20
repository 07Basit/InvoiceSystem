import { Prisma } from '@prisma/client';

/** Text matching that ignores capitals. PostgreSQL compares exactly by default; SQL Server (used before) did not. */
export const ci = (value: string): Prisma.StringFilter => ({ equals: value, mode: Prisma.QueryMode.insensitive });
export const containsCi = (value: string): Prisma.StringFilter => ({ contains: value, mode: Prisma.QueryMode.insensitive });

/** "The field is any of these values", ignoring capitals (Prisma's `in` is exact on PostgreSQL). */
export const anyOfCi = (field: string, values: string[]): { OR: Array<Record<string, Prisma.StringFilter>> } => ({
  OR: values.map((value) => ({ [field]: ci(value) })),
});
