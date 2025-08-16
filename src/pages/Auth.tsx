import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState } from '@/utils/auth';
import authBackground from '@/assets/auth-background.jpg';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    cleanupAuthState();
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Ensure no stale sessions interfere with sign-in
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {});

      const { error } = await signIn(email, password);

      if (error) {
        toast({
          title: 'Sign-in failed',
          description: `${error.message}. If this persists, ensure this site's origin is configured in Supabase Auth Redirect URLs.`,
          variant: 'destructive',
        });
      } else {
        // Hard redirect to reload app state with fresh session
        window.location.href = '/';
        return;
      }
    } catch (err: any) {
      toast({
        title: 'Unexpected error',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Clear any existing session to avoid redirect conflicts
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {});

      const { error } = await signUp(email, password, firstName, lastName);

      if (error) {
        toast({
          title: 'Sign-up failed',
          description: `${error.message}. If this persists, verify your Site URL and Allowed Redirect URLs in Supabase.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Account created! Please check your email to confirm your account.',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Unexpected error',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        background: `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(180, 100%, 35%) 50%, hsl(180, 60%, 45%) 100%)`,
      }}
    >
      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Glass Morphism Card */}
      <Card className="w-full max-w-md backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl animate-scale-in relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="https://cguoaokqwgqvzkqqezcq.supabase.co/storage/v1/object/public/assets/logos/reop-logo-full.png" 
              alt="Real Estate on Purpose Logo" 
              className="h-20 w-auto object-contain filter drop-shadow-lg"
            />
          </div>
          <CardDescription className="text-white/90 text-lg font-medium">
            Sign in to access your professional CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/20 backdrop-blur-sm">
              <TabsTrigger value="signin" className="data-[state=active]:bg-white/30 data-[state=active]:text-white text-white/80">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-white/30 data-[state=active]:text-white text-white/80">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/90 font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 backdrop-blur-sm"
                    placeholder="Enter your email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/90 font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 backdrop-blur-sm"
                    placeholder="Enter your password"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-105 font-semibold" 
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-white/90 font-medium">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 backdrop-blur-sm"
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-white/90 font-medium">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 backdrop-blur-sm"
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupEmail" className="text-white/90 font-medium">Email</Label>
                  <Input
                    id="signupEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 backdrop-blur-sm"
                    placeholder="Enter your email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupPassword" className="text-white/90 font-medium">Password</Label>
                  <Input
                    id="signupPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 backdrop-blur-sm"
                    placeholder="Create a password"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-105 font-semibold" 
                  disabled={loading}
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;