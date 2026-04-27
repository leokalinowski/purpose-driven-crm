import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AnnouncementModal } from '@/components/announcements/AnnouncementModal';
import { Menu } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Mobile-only sticky header — hidden on md+ where sidebar is always visible */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-[hsl(180_100%_25%)] px-4 md:hidden">
          <img
            src="/reop-logo-full-white.png"
            alt="Real Estate on Purpose"
            className="h-7 w-auto object-contain"
          />
          <SidebarTrigger className="text-white hover:bg-white/10 rounded-lg p-2">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
        </header>

        {/* Page content — matches design: 32px 40px on desktop, 20px 16px on mobile */}
        <main className="flex flex-col flex-1 px-10 py-8 pb-20 max-w-[1440px] max-sm:px-4 max-sm:py-5 max-sm:pb-16">
          {children}
        </main>
      </SidebarInset>
      <AnnouncementModal />
    </SidebarProvider>
  );
}
