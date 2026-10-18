import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DraftKind } from 'shared';
import { useToast } from '@/components/ui/toast';
import { draftService } from '../services/draftService';

// Before drafts lived in the database they were kept in this browser only, under these keys.
const BROWSER_KEYS: Record<DraftKind, string> = {
  invoice: 'invoice-draft-list-v1',
  importer: 'importer-draft-list-v1',
};

interface BrowserDraft {
  id?: string;
  createdAt?: string;
  data?: Record<string, unknown>;
}

function readBrowserDrafts(kind: DraftKind): BrowserDraft[] {
  try {
    const raw = localStorage.getItem(BROWSER_KEYS[kind]);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as BrowserDraft[]) : [];
  } catch {
    return [];
  }
}

/**
 * One-time move of drafts saved in this browser into the database. Each draft is removed from the browser as soon
 * as it is saved, so nothing is lost if it stops halfway and nothing is saved twice when it runs again.
 */
export async function importBrowserDrafts(kind: DraftKind): Promise<number> {
  const drafts = readBrowserDrafts(kind);
  let moved = 0;
  for (const draft of [...drafts]) {
    if (draft.data && typeof draft.data === 'object') {
      const createdAt = draft.createdAt && !Number.isNaN(Date.parse(draft.createdAt)) ? new Date(draft.createdAt).toISOString() : undefined;
      try {
        await draftService.create(kind, draft.data, createdAt);
        moved++;
      } catch {
        break; // keep the rest in the browser and try again next time
      }
    }
    drafts.splice(drafts.indexOf(draft), 1);
    try {
      if (drafts.length) localStorage.setItem(BROWSER_KEYS[kind], JSON.stringify(drafts));
      else localStorage.removeItem(BROWSER_KEYS[kind]);
    } catch {
      // storage unavailable: nothing more to do
    }
  }
  return moved;
}

/** Runs the move once after sign-in, then refreshes the drafts lists and says how many were moved. */
export function useImportBrowserDrafts() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const invoices = await importBrowserDrafts('invoice');
      const importers = await importBrowserDrafts('importer');
      if (invoices + importers === 0) return;
      await queryClient.invalidateQueries({ queryKey: ['drafts'] });
      const parts = [invoices ? `${invoices} invoice` : '', importers ? `${importers} importer` : ''].filter(Boolean).join(' and ');
      showToast('Drafts saved to your account', `${parts} draft${invoices + importers === 1 ? '' : 's'} from this browser can now be opened anywhere you sign in.`, 'success');
    })();
  }, [queryClient, showToast]);
}
