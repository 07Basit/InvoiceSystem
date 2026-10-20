import { useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ScrollToTop from '@/components/ui/ScrollToTop';
import { useImportBrowserDrafts } from '@/features/drafts/hooks/useImportBrowserDrafts';

export default function AppLayout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  useImportBrowserDrafts(); // drafts saved in this browser before they lived in the database

  return (
    // Pinned to the visible screen (not 100vh, which is taller than a phone's visible area while its address bar is showing),
    // and clipped rather than hidden so nothing can scroll the page behind the top bar: only <main> scrolls.
    <div className="fixed inset-0 flex bg-background overflow-clip">
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-clip">
        <TopBar onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
        <ScrollToTop targetRef={mainRef} />
      </div>
    </div>
  );
}
