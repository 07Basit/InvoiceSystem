import type { ReactNode } from 'react';
import { Mail, MapPin, Pencil, Phone, PlaneLanding, PlaneTakeoff, Trash2, UserCheck, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import Tooltip from '@/components/ui/Tooltip';

export interface CardLanding {
  portOfDischarge: string;
  finalDestination: string;
  countryOfDestination: string;
}

export interface CardLoading {
  portOfLoading: string;
  countryOfOrigin: string;
}

interface ImporterCardProps {
  name: string;
  buyerName?: string | null | undefined;
  currency: string;
  address: string;
  contact?: string | null | undefined;
  email?: string | null | undefined;
  landing: CardLanding[];
  loading: CardLoading[];
  /** Small line under the details, e.g. "Added 17 Oct 2026". */
  footnote?: string | undefined;
  /** Marks an unsaved draft: amber styling and a "Draft" tag. */
  draft?: boolean;
  /** Marked "not needed": greyed out, with a button to bring it back. Omit for drafts. */
  inactive?: boolean;
  onToggleActive?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}

function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}

function Detail({ icon: Icon, children }: { icon: typeof MapPin; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

export default function ImporterCard({
  name, buyerName, currency, address, contact, email, landing, loading, footnote, draft, inactive, onToggleActive,
  onEdit, onDelete, editLabel, deleteLabel,
}: ImporterCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-4 transition-shadow hover:shadow-sm', draft && 'border-amber-300/70 bg-amber-50/30', inactive && 'bg-muted/40 border-dashed')}>
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] text-sm font-bold shrink-0', inactive && 'grayscale opacity-60')}>
          {(name || '?').slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('font-semibold truncate', inactive && 'text-muted-foreground')}>{name || 'Untitled importer'}</p>
            {inactive && <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">Not needed</span>}
            {draft && <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-semibold">Draft</span>}
          </div>
          {buyerName ? <p className="text-xs text-muted-foreground truncate">Buyer: {buyerName}</p> : null}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {currency && (
            <span className={cn('mr-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', inactive ? 'border-border bg-muted text-muted-foreground' : 'border-[hsl(var(--brand-accent))]/30 bg-[hsl(var(--brand-accent))]/10 text-[hsl(var(--brand-accent))]')}>
              {currency}
            </span>
          )}
          {onToggleActive && (
            <Tooltip label={inactive ? 'Inactive. Click to make active again' : 'Mark as not needed (inactive)'} align="end">
              <button
                onClick={onToggleActive}
                className="p-1.5 hover:bg-accent rounded-md"
                aria-label={inactive ? `Make ${name} active again` : `Mark ${name} as not needed`}
              >
                {inactive ? <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> : <UserX className="h-3.5 w-3.5" />}
              </button>
            </Tooltip>
          )}
          <Tooltip label={editLabel} align="end">
            <button onClick={onEdit} className="p-1.5 hover:bg-accent rounded-md" aria-label={`${editLabel}: ${name || 'untitled'}`}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip label={deleteLabel} align="end">
            <button onClick={onDelete} className="p-1.5 hover:bg-destructive/10 rounded-md" aria-label={`${deleteLabel}: ${name || 'untitled'}`}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </Tooltip>
        </div>
      </div>

      {(address || contact || email) && (
        <div className={cn('space-y-1.5', inactive && 'opacity-60')}>
          {address && <Detail icon={MapPin}>{address}</Detail>}
          {contact && <Detail icon={Phone}>{contact}</Detail>}
          {email && <Detail icon={Mail}>{email}</Detail>}
        </div>
      )}

      <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', inactive && 'opacity-60')}>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <PlaneLanding className="h-3.5 w-3.5" /> Landing
          </p>
          <div className="flex flex-wrap gap-1.5">
            {landing.length === 0 && <span className="text-xs text-muted-foreground">None added</span>}
            {landing.map((l, i) => (
              <Chip key={`${l.portOfDischarge}-${i}`} title={`Discharge ${l.portOfDischarge} · Final destination ${l.finalDestination} · ${l.countryOfDestination}`}>
                <span className="font-semibold">{l.portOfDischarge || '—'}</span>
                {l.finalDestination && l.finalDestination !== l.portOfDischarge && <span className="text-muted-foreground">→ {l.finalDestination}</span>}
                {l.countryOfDestination && <span className="text-muted-foreground">· {l.countryOfDestination}</span>}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <PlaneTakeoff className="h-3.5 w-3.5" /> Loading
          </p>
          <div className="flex flex-wrap gap-1.5">
            {loading.length === 0 && <span className="text-xs text-muted-foreground">None added</span>}
            {loading.map((l, i) => (
              <Chip key={`${l.portOfLoading}-${i}`} title={`${l.portOfLoading} · ${l.countryOfOrigin}`}>
                <span className="font-semibold">{l.portOfLoading || '—'}</span>
                {l.countryOfOrigin && <span className="text-muted-foreground">· {l.countryOfOrigin}</span>}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}
