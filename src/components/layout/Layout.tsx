import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AnnouncementModal } from '@/components/announcements/AnnouncementModal';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background min-w-0">
        <header className="md:hidden sticky top-0 z-30 flex h-14 items-center gap-2 bg-sidebar text-sidebar-foreground px-4 border-b border-white/10">
          <SidebarTrigger className="-ml-1 text-sidebar-foreground hover:bg-white/10" />
          <span className="text-sm font-semibold">REOP</span>
        </header>
        <div className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-5 pb-16 md:px-10 md:pt-8 md:pb-20">
            {children}
          </div>
        </div>
      </SidebarInset>
      <AnnouncementModal />
    </SidebarProvider>
  );
}
