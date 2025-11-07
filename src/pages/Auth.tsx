import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState } from '@/utils/auth';
import { Chrome, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import authBackground from '@/assets/auth-background.jpg';

interface AgentProfileData {
  firstName?: string;
  lastName?: string;
  teamName?: string;
  brokerage?: string;
  phoneNumber?: string;
  officeAddress?: string;
  officeNumber?: string;
  website?: string;
  stateLicenses?: string[];
}

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [showSignInSwitch, setShowSignInSwitch] = useState(false);
  
  // Agent profile data
  const [profileData, setProfileData] = useState<AgentProfileData>({
    firstName: '',
    lastName: '',
    teamName: '',
    brokerage: '',
    phoneNumber: '',
    officeAddress: '',
    officeNumber: '',
    website: '',
    stateLicenses: [],
  });
  
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  const updateProfileData = (field: keyof AgentProfileData, value: string | string[]) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

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
      const { error } = await signIn(email, password);

      if (error) {
        toast({
          title: 'Sign-in failed',
          description: `${error.message}. If this persists, ensure this site's origin is configured in Supabase Auth Redirect URLs.`,
          variant: 'destructive',
        });
      } else {
        navigate('/');
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
    
    // Only proceed with signup if we're on step 3
    if (signupStep !== 3) {
      return;
    }
    
    setLoading(true);

    try {
      // Clear any existing session to avoid redirect conflicts
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {});

      // Validate invitation code first
      const { data: invitation, error: inviteError } = await supabase
        .from('invitations' as any)
        .select('*')
        .eq('code', inviteCode)
        .eq('email', email)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (inviteError || !invitation) {
        toast({
          title: 'Invalid invitation',
          description: 'Invalid or expired invitation code. Please check your code and email.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error } = await signUp(email, password, profileData);

      if (error) {
        // Detect repeated signup attempt
        if (error.message?.toLowerCase().includes('user already registered') || 
            error.message?.toLowerCase().includes('email already exists') ||
            error.message?.toLowerCase().includes('email address already')) {
          setShowSignInSwitch(true);
          toast({
            title: 'Account already exists',
            description: 'This email is already registered. Would you like to sign in instead?',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Sign-up failed',
            description: `${error.message}. If this persists, verify your Site URL and Allowed Redirect URLs in Supabase.`,
            variant: 'destructive',
          });
        }
        setLoading(false);
        return;
      }
      
      toast({
        title: 'Success',
        description: 'Account created! Please check your email to confirm your account.',
      });
      
      // Reset form
      setSignupStep(1);
      setEmail('');
      setPassword('');
      setInviteCode('');
      setProfileData({
        firstName: '',
        lastName: '',
        teamName: '',
        brokerage: '',
        phoneNumber: '',
        officeAddress: '',
        officeNumber: '',
        website: '',
        stateLicenses: [],
      });
    } catch (err: any) {
      console.error('Signup error:', err);
      toast({
        title: 'Unexpected error',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    
    // Set a timeout to reset loading state if redirect doesn't happen
    const timeoutId = setTimeout(() => {
      setGoogleLoading(false);
      toast({
        title: "Error",
        description: "Google sign-in took too long. Please check your configuration.",
        variant: "destructive",
      });
    }, 10000);
    
    try {
      cleanupAuthState();
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
      }

      const { error } = await signInWithGoogle();
      if (error) {
        clearTimeout(timeoutId);
        console.error('Google sign in error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to sign in with Google",
          variant: "destructive",
        });
        setGoogleLoading(false);
      }
      // If no error, keep loading=true and let redirect happen
      // Timeout will clear if redirect doesn't occur
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const nextStep = () => {
    if (signupStep < 3) setSignupStep(signupStep + 1);
  };

  const prevStep = () => {
    if (signupStep > 1) setSignupStep(signupStep - 1);
  };

  const canProceedStep1 = profileData.firstName && profileData.lastName && email && password && inviteCode;
  const canProceedStep2 = profileData.teamName && profileData.brokerage && profileData.phoneNumber;

  const renderSignupStep = () => {
    switch (signupStep) {
      case 1:
        return (
          <div
            className="space-y-4"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (canProceedStep1) nextStep();
              }
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>
              <span className="text-sm text-gray-500">Step 1 of 3</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-gray-700 font-medium">First Name *</Label>
                <Input
                  id="firstName"
                  value={profileData.firstName}
                  onChange={(e) => updateProfileData('firstName', e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                  placeholder="First name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-gray-700 font-medium">Last Name *</Label>
                <Input
                  id="lastName"
                  value={profileData.lastName}
                  onChange={(e) => updateProfileData('lastName', e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signupEmail" className="text-gray-700 font-medium">Email *</Label>
              <Input
                id="signupEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                placeholder="Enter your email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signupPassword" className="text-gray-700 font-medium">Password *</Label>
              <Input
                id="signupPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                placeholder="Create a password"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="inviteCode" className="text-gray-700 font-medium">Invitation Code *</Label>
              <Input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                placeholder="Enter invitation code"
              />
            </div>
            
            <Button 
              type="button"
              onClick={nextStep}
              disabled={!canProceedStep1}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold py-3 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Next: Professional Info <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );
        
      case 2:
        return (
          <div
            className="space-y-4"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (canProceedStep2) nextStep();
              }
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Professional Information</h3>
              <span className="text-sm text-gray-500">Step 2 of 3</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="teamName" className="text-gray-700 font-medium">Team Name *</Label>
              <Input
                id="teamName"
                value={profileData.teamName}
                onChange={(e) => updateProfileData('teamName', e.target.value)}
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                placeholder="Your team name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="brokerage" className="text-gray-700 font-medium">Brokerage *</Label>
              <Input
                id="brokerage"
                value={profileData.brokerage}
                onChange={(e) => updateProfileData('brokerage', e.target.value)}
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                placeholder="Your brokerage name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-gray-700 font-medium">Phone Number *</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={profileData.phoneNumber}
                onChange={(e) => updateProfileData('phoneNumber', e.target.value)}
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                placeholder="(555) 123-4567"
                required
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                type="button"
                onClick={prevStep}
                variant="outline"
                className="flex-1 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-lg transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button 
                type="button"
                onClick={nextStep}
                disabled={!canProceedStep2}
                className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold py-3 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Next: Location & Licenses <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );
        
      case 3:
        return (
          <form onSubmit={handleSignUp} noValidate className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Location & Licensing</h3>
              <span className="text-sm text-gray-500">Step 3 of 3</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="officeAddress" className="text-gray-700 font-medium">Office Address</Label>
              <Textarea
                id="officeAddress"
                value={profileData.officeAddress}
                onChange={(e) => updateProfileData('officeAddress', e.target.value)}
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                placeholder="Your office address"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="officeNumber" className="text-gray-700 font-medium">Office Number</Label>
                <Input
                  id="officeNumber"
                  type="tel"
                  value={profileData.officeNumber}
                  onChange={(e) => updateProfileData('officeNumber', e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website" className="text-gray-700 font-medium">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={profileData.website}
                  onChange={(e) => updateProfileData('website', e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="stateLicenses" className="text-gray-700 font-medium">State Licenses</Label>
              <Input
                id="stateLicenses"
                value={profileData.stateLicenses?.join(', ') || ''}
                onChange={(e) => {
                  const licenses = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
                  updateProfileData('stateLicenses', licenses);
                }}
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                placeholder="CA, NV, AZ (comma-separated)"
              />
              <p className="text-xs text-gray-500">
                Example: <span className="font-medium">CA, NV, AZ</span> - Enter state codes separated by commas
              </p>
              {profileData.stateLicenses && profileData.stateLicenses.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {profileData.stateLicenses.map((license, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      {license}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                type="button"
                onClick={prevStep}
                variant="outline"
                className="flex-1 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-lg transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button 
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold py-3 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? 'Creating account...' : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </div>
          </form>
        );
        
      default:
        return null;
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
      <Card className="w-full max-w-md backdrop-blur-lg bg-white/90 border-white/30 shadow-2xl animate-scale-in relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="https://cguoaokqwgqvzkqqezcq.supabase.co/storage/v1/object/public/assets/logos/reop-logo-full.png" 
              alt="Real Estate on Purpose Logo" 
              className="h-20 w-auto object-contain filter drop-shadow-lg"
            />
          </div>
          <CardDescription className="text-gray-600 text-lg font-medium">
            Sign in to access your professional CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100 backdrop-blur-sm">
              <TabsTrigger value="signin" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-700">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-700">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <Button 
                onClick={handleGoogleSignIn}
                variant="outline"
                className="w-full border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-lg transition-all duration-300 mb-4"
                disabled={googleLoading}
              >
                <Chrome className="w-5 h-5 mr-2" />
                {googleLoading ? "Signing In..." : "Continue with Google"}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                    placeholder="Enter your email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                    placeholder="Enter your password"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold py-3 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" 
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              {showSignInSwitch && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 mb-2">
                    This email is already registered. Would you like to sign in instead?
                  </p>
                  <Button
                    variant="outline"
                    className="w-full border-yellow-300 bg-white hover:bg-yellow-50"
                    onClick={() => {
                      setShowSignInSwitch(false);
                      // Switch to sign in tab
                      const signInTab = document.querySelector('[value="signin"]') as HTMLButtonElement;
                      signInTab?.click();
                    }}
                  >
                    Switch to Sign In
                  </Button>
                </div>
              )}
              
              <Button 
                onClick={handleGoogleSignIn}
                variant="outline"
                className="w-full border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-lg transition-all duration-300 mb-4"
                disabled={googleLoading}
              >
                <Chrome className="w-5 h-5 mr-2" />
                {googleLoading ? "Signing Up..." : "Continue with Google"}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with email</span>
                </div>
              </div>

              <div className="space-y-4 mt-4">
                {renderSignupStep()}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;