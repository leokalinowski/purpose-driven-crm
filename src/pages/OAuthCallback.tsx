import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing OAuth callback...');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const platform = searchParams.get('platform');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(error);
        }

        if (!code || !platform) {
          throw new Error('Missing required parameters');
        }

        if (!user) {
          throw new Error('User not authenticated');
        }

        // Call the social-oauth edge function to complete the OAuth flow
        const { data, error: functionError } = await supabase.functions.invoke('social-oauth', {
          body: {
            platform,
            code,
            state,
            agent_id: user.id
          }
        });

        if (functionError) {
          throw functionError;
        }

        if (data.error) {
          throw new Error(data.error);
        }

        setStatus('success');
        setMessage(data.message || 'Account connected successfully!');
        
        toast({
          title: 'Success',
          description: data.message || 'Social media account connected successfully',
        });

        // Redirect back to social scheduler after a brief delay
        setTimeout(() => {
          navigate('/social-scheduler');
        }, 2000);

      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An error occurred during OAuth callback');
        
        toast({
          title: 'Error',
          description: 'Failed to connect social media account',
          variant: 'destructive',
        });

        // Redirect back to social scheduler after a brief delay
        setTimeout(() => {
          navigate('/social-scheduler');
        }, 3000);
      }
    };

    processCallback();
  }, [searchParams, user, navigate]);

  const StatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>OAuth Callback</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <StatusIcon />
          <p className="text-muted-foreground">{message}</p>
          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              Redirecting you back to the social scheduler...
            </p>
          )}
          {status === 'error' && (
            <p className="text-sm text-muted-foreground">
              Taking you back to try again...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OAuthCallback;