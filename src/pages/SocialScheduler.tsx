import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Calendar, BarChart3, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Layout } from '@/components/layout/Layout';
import { SocialPostForm } from '@/components/social/SocialPostForm';
import { SocialCalendar } from '@/components/social/SocialCalendar';
import { SocialAnalytics } from '@/components/social/SocialAnalytics';
import { SocialCSVUpload } from '@/components/social/SocialCSVUpload';
import { ConnectSocialAccounts } from '@/components/social/ConnectSocialAccounts';
import { useSocialAccounts } from '@/hooks/useSocialScheduler';
import { useAuth } from '@/hooks/useAuth';

export default function SocialScheduler() {
  const { user } = useAuth();
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false);
  const [isCSVDialogOpen, setIsCSVDialogOpen] = useState(false);
  
  const { data: accounts = [] } = useSocialAccounts();

  const handlePostSuccess = () => {
    setIsPostDialogOpen(false);
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 space-y-6">
      <Helmet>
        <title>Social Media Scheduler | Real Estate on Purpose</title>
        <meta
          name="description"
          content="Schedule and manage your social media posts across multiple platforms. Track analytics and engagement for your real estate business."
        />
      </Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Media Scheduler</h1>
          <p className="text-muted-foreground">
            Schedule posts, manage content, and track performance across all your social platforms
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Dialog open={isCSVDialogOpen} onOpenChange={setIsCSVDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Bulk Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Upload Posts</DialogTitle>
              </DialogHeader>
              <SocialCSVUpload />
            </DialogContent>
          </Dialog>
          
          <Dialog open={isPostDialogOpen} onOpenChange={setIsPostDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Post</DialogTitle>
              </DialogHeader>
              <SocialPostForm onSuccess={handlePostSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {accounts.length === 0 && (
        <ConnectSocialAccounts connectedAccounts={accounts} />
      )}

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Accounts ({accounts.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <SocialCalendar />
        </TabsContent>

        <TabsContent value="analytics">
          <SocialAnalytics />
        </TabsContent>

        <TabsContent value="accounts">
          <ConnectSocialAccounts connectedAccounts={accounts} />
        </TabsContent>
      </Tabs>
      </div>
    </Layout>
  );
}