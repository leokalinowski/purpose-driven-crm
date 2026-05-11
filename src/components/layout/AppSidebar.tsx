import {
  LayoutDashboard,
  Users,
  Calendar,
  Mail,
  TrendingUp,
  FolderOpen,
  KanbanSquare,
  LogOut,
  BarChart3,
  UserPlus,
  Settings,
  Share2,
  Database,
  FileText,
  RotateCcw,
  LifeBuoy,
  Handshake,
  ClipboardList,
  ChevronRight,
  Megaphone,
  GraduationCap,
  Briefcase,
  Gift,
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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard },
      { title: 'SphereSync', url: '/spheresync-tasks', icon: Users },
      { title: 'Database', url: '/database', icon: FolderOpen },
      { title: 'Pipeline', url: '/pipeline', icon: KanbanSquare },
      { title: 'Events', url: '/events', icon: Calendar },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { title: 'E-Newsletter', url: '/newsletter', icon: Mail },
      { title: 'Social Media', url: '/social-scheduler', icon: Share2 },
      { title: 'Surprise & Delight', url: '/delight', icon: Gift },
    ],
  },
  {
    label: 'Performance',
    items: [
      // Scoreboard is the merged Coaching + Scoreboard page. /coaching now
      // redirects here; bookmarks and old deep links still resolve.
      { title: 'Success Scoreboard', url: '/scoreboard', icon: TrendingUp },
      // Admin-only — also gated by RouteGuard via /transactions tier='admin'.
      { title: 'Transactions', url: '/transactions', icon: Briefcase, adminOnly: true },
    ],
  },
  {
    label: 'Help',
    items: [
      { title: 'Support Hub', url: '/support', icon: LifeBuoy },
      { title: 'Resources', url: '/resources', icon: FileText },
      { title: 'Settings', url: '/settings', icon: Settings },
    ],
  },
];

interface AdminItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

function AdminSubGroup({
  label,
  icon: Icon,
  items,
  pathname,
}: {
  label: string;
  icon: LucideIcon;
  items: AdminItem[];
  pathname: string;
}) {
  const isGroupActive = items.some((item) => pathname === item.url);

  return (
    <Collapsible defaultOpen={isGroupActive}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground transition-colors">
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenu className="ml-4 mt-0.5 gap-0.5">
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

function getInitials(name: string): string {
  if (!name) return '··';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { getDisplayName } = useUserProfile();
  const { isAdmin } = useUserRole();
  const { hasAccess } = useFeatureAccess();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isItemActive = (url: string) => {
    const [path, query] = url.split('?');
    if (location.pathname !== path) return false;
    if (!query) return location.search === '' || !location.search.includes('tab=');
    const params = new URLSearchParams(query);
    const target = params.get('tab');
    if (!target) return true;
    const current = new URLSearchParams(location.search).get('tab');
    return current === target;
  };

  const displayName = getDisplayName() || user?.email?.split('@')[0] || 'You';
  const initials = getInitials(displayName);

  return (
    <Sidebar>
      <SidebarHeader className="px-3 pt-5 pb-3">
        <div className="flex items-center gap-2.5 px-2">
          <img
            src="https://cguoaokqwgqvzkqqezcq.supabase.co/storage/v1/object/public/assets/logos/reop-logo-full.png"
            alt="Real Estate on Purpose"
            className="h-8 w-auto object-contain brightness-0 invert"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 gap-4">
        {navGroups.map((group) => {
          // Hide admin-only items from non-admins (existing behavior), AND
          // hide items whose route is tier-gated for this user (new). The
          // route-level tier gate lives in useFeatureAccess.ROUTE_MIN_TIER —
          // e.g. /transactions is at 'agent' tier so core users don't see it.
          const visibleItems = group.items.filter(
            (item) => (!item.adminOnly || isAdmin) && hasAccess(item.url)
          );
          if (visibleItems.length === 0) return null;
          return (
            <SidebarGroup key={group.label} className="p-0">
              <SidebarGroupLabel className="px-3 pt-2 pb-1 text-[10.5px] uppercase tracking-[0.07em] font-semibold text-sidebar-foreground/55">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isItemActive(item.url)}
                        aria-label={`Navigate to ${item.title}`}
                        className="h-[38px] rounded-lg px-3 text-sm font-medium text-sidebar-foreground/80 data-[active=true]:bg-white/[0.16] data-[active=true]:font-semibold data-[active=true]:text-sidebar-foreground hover:bg-white/[0.09] hover:text-sidebar-foreground"
                      >
                        <Link to={item.url}>
                          <item.icon aria-hidden="true" className="!size-4" strokeWidth={2} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {isAdmin && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-3 pt-2 pb-1 text-[10.5px] uppercase tracking-[0.07em] font-semibold text-sidebar-foreground/55">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-col gap-0.5">
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
                  { title: 'Social Media', url: '/admin/social-scheduler', icon: Share2 },
                  { title: 'Events Management', url: '/admin/events', icon: Calendar },
                  { title: 'Support Articles', url: '/admin/support-articles', icon: LifeBuoy },
                  { title: 'Email Logs', url: '/admin/email-logs', icon: FileText },
                  { title: 'Resources', url: '/admin/resources', icon: FolderOpen },
                ]}
                pathname={location.pathname}
              />
              <AdminSubGroup
                label="Operations"
                icon={Settings}
                items={[
                  { title: 'Database Management', url: '/admin/database', icon: Database },
                  { title: 'SphereSync Recovery', url: '/admin/spheresync-recovery', icon: RotateCcw },
                  { title: 'SphereSync Management', url: '/admin/coaching', icon: GraduationCap },
                ]}
                pathname={location.pathname}
              />
              <AdminSubGroup
                label="Business & Research"
                icon={Handshake}
                items={[
                  { title: 'Sponsor Database', url: '/admin/sponsors', icon: Handshake },
                  { title: 'Survey Results', url: '/admin/survey-results', icon: ClipboardList },
                  { title: 'Announcements', url: '/admin/announcements', icon: Megaphone },
                ]}
                pathname={location.pathname}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4 pt-3 border-t border-white/[0.12] gap-2">
        <div className="flex items-center gap-2.5 px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-reop-green text-reop-dark-blue-2 text-[12px] font-bold">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-sidebar-foreground truncate">{displayName}</span>
            <span className="text-[11px] text-sidebar-foreground/70 truncate">
              {user?.email ?? 'Signed in'}
            </span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          aria-label="Sign out of your account"
          className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/80 hover:bg-white/[0.09] hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
