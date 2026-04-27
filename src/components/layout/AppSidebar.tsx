import {
  LayoutDashboard,
  Users,
  Calendar,
  Mail,
  TrendingUp,
  FolderOpen,
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
  KanbanSquare,
  Briefcase,
  GraduationCap,
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

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard, adminOnly: true },
      { title: 'SphereSync', url: '/spheresync-tasks', icon: Users },
      { title: 'Database', url: '/database', icon: FolderOpen },
      { title: 'Pipeline', url: '/spheresync-tasks', icon: KanbanSquare },
      { title: 'Events', url: '/events', icon: Calendar },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { title: 'E-Newsletter', url: '/newsletter', icon: Mail },
      { title: 'Social Media', url: '/social-scheduler', icon: Share2 },
    ],
  },
  {
    label: 'Performance',
    items: [
      { title: 'Success Scoreboard', url: '/coaching', icon: TrendingUp },
      { title: 'Transactions', url: '/transactions', icon: Briefcase },
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

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#99ca3c] text-[#003d47] text-xs font-bold">
      {initials}
    </div>
  );
}

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { getDisplayName } = useUserProfile();
  const { isAdmin } = useUserRole();
  const { hasAccess } = useFeatureAccess();
  const navigate = useNavigate();
  const location = useLocation();

  const displayName = getDisplayName();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-3.5 py-5 border-b border-sidebar-border/30">
        <img
          src="/reop-logo-full-white.png"
          alt="Real Estate on Purpose"
          className="h-8 w-auto object-contain"
        />
      </SidebarHeader>

      <SidebarContent className="py-3">
        {/* Agent navigation — 4 groups */}
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => (!item.adminOnly || isAdmin) && hasAccess(item.url)
          );
          if (visibleItems.length === 0) return null;
          return (
            <SidebarGroup key={group.label} className="px-2 py-0 mb-1">
              <SidebarGroupLabel className="px-2 text-[10.5px] uppercase tracking-[0.07em] font-semibold opacity-55 h-7">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === item.url}
                        aria-label={`Navigate to ${item.title}`}
                      >
                        <Link to={item.url}>
                          <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
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

        {/* Admin section */}
        {isAdmin && (
          <SidebarGroup className="px-2 mt-2 border-t border-sidebar-border/30 pt-3">
            <SidebarGroupLabel className="px-2 text-[10.5px] uppercase tracking-[0.07em] font-semibold opacity-55 h-7">
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

      <SidebarFooter className="border-t border-sidebar-border/30 p-3">
        <div className="flex items-center gap-2.5 mb-3">
          <UserAvatar name={displayName} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
              {displayName}
            </div>
            <button
              onClick={handleSignOut}
              className="text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors flex items-center gap-1 mt-0.5"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
