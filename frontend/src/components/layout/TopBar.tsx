import { Bell, Search } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Search className="h-4 w-4" />
        <span className="text-sm">Search...</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-md hover:bg-accent transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
          U
        </div>
      </div>
    </header>
  );
}
