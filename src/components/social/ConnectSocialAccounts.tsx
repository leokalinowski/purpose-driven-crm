import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useConnectSocialAccount } from '@/hooks/useSocialScheduler';
import { Loader2, Facebook, Instagram, Linkedin, Twitter, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConnectSocialAccountsProps {
  agentId?: string;
  connectedAccounts?: Array<{
    id: string;
    platform: string;
    account_name?: string;
    created_at: string;
  }>;
}

const socialPlatforms = [
  {
    name: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600',
    status: 'working', // Working with direct API fallback
    description: 'Fully functional with direct posting',
  },
  {
    name: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    status: 'coming_soon', // Not yet implemented
    description: 'Coming soon - requires Instagram Business API',
  },
  {
    name: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700',
    status: 'coming_soon', // Not yet implemented
    description: 'Coming soon - requires LinkedIn API',
  },
  {
    name: 'twitter',
    label: 'Twitter',
    icon: Twitter,
    color: 'bg-blue-400',
    status: 'coming_soon', // Not yet implemented
    description: 'Coming soon - requires Twitter API v2',
  },
];

export function ConnectSocialAccounts({ agentId, connectedAccounts = [] }: ConnectSocialAccountsProps) {
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const { toast } = useToast();
  
  const connectAccountMutation = useConnectSocialAccount();

  const handleConnect = async (platform: string) => {
    setConnectingPlatform(platform);
    
    try {
      const result = await connectAccountMutation.mutateAsync({
        platform,
        agentId: agentId,
      });
      
      // The OAuth URL is returned, redirect to it
      if (result.oauth_url) {
        window.location.href = result.oauth_url;
      }
    } catch (error) {
      console.error('Error connecting account:', error);
      toast({
        title: 'Connection Error',
        description: `Failed to connect ${platform}. Please try again.`,
        variant: 'destructive',
      });
      setConnectingPlatform(null);
    }
  };

  const isConnected = (platform: string) => {
    return connectedAccounts.some(account => account.platform.toLowerCase() === platform.toLowerCase());
  };

  const getConnectedAccount = (platform: string) => {
    return connectedAccounts.find(account => account.platform.toLowerCase() === platform.toLowerCase());
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">Connect Social Media Accounts</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Connect your social media accounts to start scheduling posts and viewing analytics.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {socialPlatforms.map((platform) => {
          const connected = isConnected(platform.name);
          const account = getConnectedAccount(platform.name);
          const isConnecting = connectingPlatform === platform.name;
          const IconComponent = platform.icon;

          const getStatusIcon = () => {
            if (connected) return <CheckCircle className="h-4 w-4 text-green-600" />;
            if (platform.status === 'working') return <CheckCircle className="h-4 w-4 text-blue-600" />;
            if (platform.status === 'coming_soon') return <Clock className="h-4 w-4 text-yellow-600" />;
            return <AlertCircle className="h-4 w-4 text-red-600" />;
          };

          const getStatusBadge = () => {
            if (connected) {
              return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                Connected
              </Badge>;
            }
            if (platform.status === 'working') {
              return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                Ready to Connect
              </Badge>;
            }
            return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              Coming Soon
            </Badge>;
          };

          return (
            <Card key={platform.name} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg ${platform.color} flex items-center justify-center text-white relative`}>
                      <IconComponent className="h-5 w-5" />
                      <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5">
                        {getStatusIcon()}
                      </div>
                    </div>
                    <div>
                      <span>{platform.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{platform.description}</p>
                    </div>
                  </CardTitle>
                  {getStatusBadge()}
                </div>
              </CardHeader>
              
              <CardContent>
                {connected && account ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Account: {account.account_name || 'Connected'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Connected on {new Date(account.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {platform.status === 'working'
                        ? `Connect your ${platform.label} account to schedule posts`
                        : platform.description
                      }
                    </p>
                    <Button
                      onClick={() => handleConnect(platform.name)}
                      disabled={isConnecting || connectAccountMutation.isPending || platform.status !== 'working'}
                      className="w-full"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : platform.status === 'working' ? (
                        `Connect ${platform.label}`
                      ) : (
                        'Coming Soon'
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {connectedAccounts.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            You have {connectedAccounts.length} social media account{connectedAccounts.length !== 1 ? 's' : ''} connected.
          </p>
        </div>
      )}
    </div>
  );
}