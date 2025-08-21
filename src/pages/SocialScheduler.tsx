import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Calendar, BarChart3, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SocialPostForm } from '@/components/social/SocialPostForm';
import { SocialCalendar } from '@/components/social/SocialCalendar';
import { SocialAnalytics } from '@/components/social/SocialAnalytics';
import { SocialCSVUpload } from '@/components/social/SocialCSVUpload';
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 text-sm">!</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                No Social Media Accounts Connected
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Connect your social media accounts to start scheduling posts and viewing analytics.
                Contact your administrator to set up platform integrations.
              </p>
            </div>
          </div>
        </div>
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
          <div className="grid gap-4">
            {accounts.length > 0 ? (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium capitalize">
                        {account.platform[0]}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium capitalize">{account.platform}</div>
                      <div className="text-sm text-muted-foreground">
                        {account.account_name || 'Connected'}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Connected on {new Date(account.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="text-muted-foreground">
                  No social media accounts connected yet.
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Contact your administrator to set up social media integrations.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}