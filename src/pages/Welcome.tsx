import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';

const Welcome = () => {
  const { user } = useAuth();
  const { checkSubscription } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const checkoutSuccess = searchParams.get('checkout') === 'success';

  useEffect(() => {
    if (checkoutSuccess && user) {
      checkSubscription();
    }
    // Clean up query params after a delay
    if (checkoutSuccess) {
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [checkoutSuccess, user]);

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4">
        <div className="flex justify-center pt-6 pb-2">
          <img
            src="https://cguoaokqwgqvzkqqezcq.supabase.co/storage/v1/object/public/assets/logos/reop-logo-full.png"
            alt="Real Estate on Purpose"
            className="h-14 w-auto object-contain"
          />
        </div>
        <div className="max-w-lg mx-auto py-16 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome to Real Estate on Purpose!
          </h1>
          <p className="text-lg text-muted-foreground">
            Your subscription is now active. You're all set to start growing your business with purpose.
          </p>
          {!user && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">📧 Check your email</p>
              <p>
                We've sent you a link to set your password and sign in to your dashboard.
                Be sure to check your spam folder if you don't see it.
              </p>
            </div>
          )}
          <div className="pt-4">
            {user ? (
              <Button size="lg" onClick={() => navigate('/')}>
                Go to Dashboard
              </Button>
            ) : (
              <Button size="lg" onClick={() => navigate('/auth')}>
                Sign In to Your Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
