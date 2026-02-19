import {
  Home,
  Users,
  Calendar,
  Mail,
  TrendingUp,
  Phone,
  LogOut,
  BarChart3,
  UserPlus,
  Settings,
  Share,
  Database,
  FileText,
  RotateCcw,
  LifeBuoy,
  Handshake,
  ClipboardList,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserRole } from '@/hooks/useUserRole';

interface AdminItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

function AdminSubGroup({ label, icon: Icon, items, pathname }: {
  label: string;
  icon: LucideIcon;
  items: AdminItem[];
  pathname: string;
}) {
  const isGroupActive = items.some((item) => pathname === item.url);

  return (
    <Collapsible defaultOpen={isGroupActive}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors group">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenu className="ml-4 mt-0.5">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={pathname === item.url}>
                <Link to={item.url}>
                  <item.icon aria-hidden="true" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}

const menuItems = [
  { title: 'Agent Dashboard', url: '/', icon: Home },
  { title: 'SphereSync', url: '/spheresync-tasks', icon: Phone },
  { title: 'Database', url: '/database', icon: Users },
  { title: 'Events', url: '/events', icon: Calendar },
  { title: 'E-Newsletter', url: '/newsletter', icon: Mail },
  { title: 'Social Media', url: '/social-scheduler', icon: Share },
  { title: 'Success Scoreboard', url: '/coaching', icon: TrendingUp },
  { title: 'Support Hub', url: '/support', icon: LifeBuoy },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { getDisplayName } = useUserProfile();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-3 md:p-4 border-b border-sidebar-border">
        <div className="flex flex-col items-start gap-3 mb-3">
          <img 
            src="https://cguoaokqwgqvzkqqezcq.supabase.co/storage/v1/object/public/assets/logos/reop-logo-full.png" 
            alt="Real Estate on Purpose Logo" 
            className="h-8 sm:h-10 md:h-12 lg:h-14 w-auto object-contain brightness-0 invert"
          />
        </div>
        <div className="text-base md:text-lg font-medium text-sidebar-foreground truncate text-left">
          {getDisplayName()}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={location.pathname === item.url}
                    aria-label={`Navigate to ${item.title}`}
                  >
                    <Link to={item.url}>
                      <item.icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <AdminSubGroup
                label="Dashboard & Team"
                icon={BarChart3}
                items={[
                  { title: 'Admin Dashboard', url: '/admin/dashboard', icon: BarChart3 },
                  { title: 'Team Management', url: '/admin/team-management', icon: UserPlus },
                ]}
                pathname={location.pathname}
              />
              <AdminSubGroup
                label="Content & Comms"
                icon={Mail}
                items={[
                  { title: 'Newsletter Management', url: '/admin/newsletter', icon: Mail },
                  { title: 'Social Media', url: '/admin/social-scheduler', icon: Share },
                  { title: 'Events Management', url: '/admin/events', icon: Calendar },
                  { title: 'Email Logs', url: '/admin/email-logs', icon: FileText },
                ]}
                pathname={location.pathname}
              />
              <AdminSubGroup
                label="Operations"
                icon={Settings}
                items={[
                  { title: 'Database Management', url: '/admin/database', icon: Database },
                  { title: 'SphereSync Recovery', url: '/admin/spheresync-recovery', icon: RotateCcw },
                  { title: 'Coaching Management', url: '/admin/coaching', icon: TrendingUp },
                ]}
                pathname={location.pathname}
              />
              <AdminSubGroup
                label="Business & Research"
                icon={Handshake}
                items={[
                  { title: 'Sponsor Database', url: '/admin/sponsors', icon: Handshake },
                  { title: 'Survey Results', url: '/admin/survey-results', icon: ClipboardList },
                ]}
                pathname={location.pathname}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      <SidebarFooter className="p-4">
        <Button
          variant="secondary"
          onClick={handleSignOut}
          className="w-full justify-start"
          aria-label="Sign out of your account"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}