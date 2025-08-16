import { 
  Home,
  Users,
  Calendar,
  Mail,
  TrendingUp,
  UserCheck,
  FileBarChart,
  Phone,
  LogOut
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

const menuItems = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'PO2 Tasks', url: '/po2-tasks', icon: Phone },
  { title: 'Database', url: '/database', icon: Users },
  { title: 'Events', url: '/events', icon: Calendar },
  { title: 'E-Newsletter', url: '/newsletter', icon: Mail },
  { title: 'Success Scoreboard', url: '/coaching', icon: TrendingUp },
  { title: 'Transaction Coordination', url: '/transactions', icon: FileBarChart },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <img 
            src="/src/assets/reop-logo.png" 
            alt="Real Estate on Purpose Logo" 
            className="h-8 w-auto object-contain"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-sidebar-foreground truncate">Real Estate on Purpose</h2>
          </div>
        </div>
        <div className="text-xs text-sidebar-foreground/70 truncate">
          {user?.email}
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
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4">
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full justify-start"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}