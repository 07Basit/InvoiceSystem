import type { Draft } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { CreateDraftDto, DraftKind, UpdateDraftDto } from 'shared';

/** Drafts are small forms; this stops a runaway client filling the table. */
export const MAX_DRAFT_CHARS = 200_000;
/** Most drafts one person can keep per kind. */
export const MAX_DRAFTS_PER_KIND = 200;

export interface DraftView {
  id: string;
  kind: DraftKind;
  title: string | null;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** What to call the draft in a list: the invoice number or importer name typed so far. */
export function draftTitle(kind: DraftKind, data: Record<string, unknown>): string | null {
  const raw = kind === 'invoice' ? data['invoiceNumber'] : data['name'];
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 200) : null;
}

function serialize(data: Record<string, unknown>): string {
  const json = JSON.stringify(data);
  if (json.length > MAX_DRAFT_CHARS) throw new AppError('This draft is too large to save', 413, 'DRAFT_TOO_LARGE');
  return json;
}

function view(row: Draft): DraftView {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.data);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    // a damaged draft shows up empty instead of breaking the list
  }
  return { id: row.id, kind: row.kind as DraftKind, title: row.title, data, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

async function ownOrThrow(userId: string, id: string): Promise<Draft> {
  const row = await prisma.draft.findFirst({ where: { id, userId } });
  if (!row) throw new AppError('Draft not found', 404, 'DRAFT_NOT_FOUND');
  return row;
}

export const draftService = {
  /** Newest first. Only the signed-in person's own drafts. */
  async list(userId: string, kind: DraftKind): Promise<DraftView[]> {
    const rows = await prisma.draft.findMany({ where: { userId, kind }, orderBy: { updatedAt: 'desc' } });
    return rows.map(view);
  },

  async create(userId: string, dto: CreateDraftDto): Promise<DraftView> {
    const data = serialize(dto.data);
    if ((await prisma.draft.count({ where: { userId, kind: dto.kind } })) >= MAX_DRAFTS_PER_KIND) {
      throw new AppError('Too many drafts. Delete some you no longer need.', 400, 'TOO_MANY_DRAFTS');
    }
    const row = await prisma.draft.create({
      data: { userId, kind: dto.kind, title: draftTitle(dto.kind, dto.data), data, ...(dto.createdAt ? { createdAt: new Date(dto.createdAt) } : {}) },
    });
    return view(row);
  },

  async update(userId: string, id: string, dto: UpdateDraftDto): Promise<DraftView> {
    const existing = await ownOrThrow(userId, id);
    const row = await prisma.draft.update({
      where: { id },
      data: { data: serialize(dto.data), title: draftTitle(existing.kind as DraftKind, dto.data) },
    });
    return view(row);
  },

  async remove(userId: string, id: string): Promise<void> {
    await ownOrThrow(userId, id);
    await prisma.draft.delete({ where: { id } });
  },
};
