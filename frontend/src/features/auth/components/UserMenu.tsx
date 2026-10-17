import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, UserCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export function userInitial(name: string | undefined) {
  return (name?.trim()[0] ?? 'U').toUpperCase();
}

export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = () => {
    setOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 hover:bg-accent transition-colors"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="h-8 w-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-xs font-bold ring-2 ring-[hsl(var(--primary))]/20">
          {userInitial(user?.displayName)}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 top-12 w-64 max-w-[90vw] rounded-xl border bg-card shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b bg-secondary/30">
            <p className="text-sm font-semibold truncate">{user?.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
          </div>
          <div className="p-1.5">
            <Link
              to="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
            >
              <UserCircle className="h-4 w-4 text-muted-foreground" /> My Profile
            </Link>
            <button
              role="menuitem"
              onClick={signOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
