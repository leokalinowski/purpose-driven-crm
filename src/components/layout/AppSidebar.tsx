import {
  Home,
  Users,
  Calendar,
  Mail,
  TrendingUp,
  UserCheck,
  FileBarChart,
  Phone,
  LogOut,
  BarChart3,
  UserPlus,
  Settings,
  Share,
  Database,
  FileText
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

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserRole } from '@/hooks/useUserRole';

const menuItems = [
  { title: 'Agent Dashboard', url: '/', icon: Home },
  { title: 'SphereSync', url: '/spheresync-tasks', icon: Phone },
  { title: 'Database', url: '/database', icon: Users },
  { title: 'Events', url: '/events', icon: Calendar },
  { title: 'E-Newsletter', url: '/newsletter', icon: Mail },
  { title: 'Social Media', url: '/social-scheduler', icon: Share },
  { title: 'Success Scoreboard', url: '/coaching', icon: TrendingUp },
  // Transaction Coordination hidden from menu but route remains accessible via direct URL
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
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild
                    isActive={location.pathname === '/admin/dashboard'}
                  >
                    <Link to="/admin/dashboard">
                      <BarChart3 />
                      <span>Admin Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild
                    isActive={location.pathname === '/admin/team-management'}
                  >
                    <Link to="/admin/team-management">
                      <UserPlus />
                      <span>Team Management</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/admin/events'}
                  >
                    <Link to="/admin/events">
                      <Calendar />
                      <span>Events Management</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/admin/newsletter'}
                  >
                    <Link to="/admin/newsletter">
                      <Mail />
                      <span>Newsletter Management</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/admin/database'}
                  >
                    <Link to="/admin/database">
                      <Database />
                      <span>Database Management</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/admin/social-scheduler'}
                  >
                    <Link to="/admin/social-scheduler">
                      <Share />
                      <span>Social Media</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/admin/email-logs'}
                  >
                    <Link to="/admin/email-logs">
                      <FileText />
                      <span>Email Logs</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
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