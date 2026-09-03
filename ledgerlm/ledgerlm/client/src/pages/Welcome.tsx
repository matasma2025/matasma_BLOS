import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { NetworkBackground } from '@/components/NetworkBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ShieldCheck, Lock, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { setAuthUser } from '@/lib/auth';

interface AuthResponse {
  success: boolean;
  requiresOtp?: boolean;
  user?: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  };
}

interface SsoConfigResponse {
  authMethod: 'otp' | 'microsoft_sso';
}

function extractDomain(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return '';
  return email.slice(at + 1).toLowerCase().trim();
}

const SSO_ERROR_MESSAGES: Record<string, string> = {
  not_registered: 'Your account is not registered for this domain. Please contact your administrator.',
  domain_mismatch: 'Your Microsoft account email does not match the expected domain.',
  microsoft_error: 'Microsoft returned an error. Please try again.',
  config_error: 'SSO is not configured correctly for this domain. Please contact your administrator.',
  invalid_state: 'Invalid SSO session state. Please try again.',
  missing_params: 'Incomplete SSO response from Microsoft. Please try again.',
  domain_not_found: 'Domain not found. Please contact your administrator.',
  server_error: 'A server error occurred during sign-in. Please try again.',
};

const CAROUSEL_SLIDES = [
  'Connect, analyze, and summarize financial reports, balance sheets, and audits—all in one secure workspace.',
  'Ask questions in plain language and get instant answers from your financial data—no SQL, no exports.',
  'Enterprise-grade security with Microsoft SSO, role-based access, and full audit logging built in.',
];

export default function Welcome() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [email, setEmail] = useState('');
  const [detectedDomain, setDetectedDomain] = useState('');
  const [slideIndex, setSlideIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const { toast } = useToast();

  // Auto-rotate carousel every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setSlideIndex(i => (i + 1) % CAROUSEL_SLIDES.length);
        setFadeIn(true);
      }, 350);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Show SSO error if redirected back from failed SSO
  useEffect(() => {
    const params = new URLSearchParams(search);
    const ssoError = params.get('sso_error');
    if (ssoError) {
      toast({
        title: 'Sign in failed',
        description: SSO_ERROR_MESSAGES[ssoError] || 'An error occurred during Microsoft sign-in.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/');
    }
  }, [search]);

  useEffect(() => {
    setDetectedDomain(extractDomain(email));
  }, [email]);

  const hasDomain = detectedDomain.length > 0 && detectedDomain.includes('.');
  const { data: ssoConfig, isLoading: ssoConfigLoading } = useQuery<SsoConfigResponse>({
    queryKey: ['/api/auth/sso/config', detectedDomain],
    queryFn: async () => {
      if (!detectedDomain) return { authMethod: 'otp' as const };
      const res = await fetch(`/api/auth/sso/config?domain=${encodeURIComponent(detectedDomain)}`);
      return res.json();
    },
    enabled: hasDomain,
    staleTime: 30_000,
  });

  const isSsoEnabled = ssoConfig?.authMethod === 'microsoft_sso';
  const isResolvingAuthMethod = hasDomain && ssoConfigLoading;

  const signInMutation = useMutation({
    mutationFn: async (data: { email: string; deviceToken?: string }) =>
      apiRequest<AuthResponse>('POST', '/api/auth/signin', data),
    onSuccess: (data, variables) => {
      if (data.requiresOtp) {
        sessionStorage.setItem('otp_email', variables.email);
        toast({ title: 'Verification required', description: "We've sent a verification code to your email." });
        setLocation('/verify-otp');
      } else if (data.user) {
        setAuthUser(data.user);
        queryClient.clear();
        setLocation('/dashboard');
      }
    },
    onError: () => {
      toast({ title: 'Sign in failed', description: 'Please check your credentials and try again.', variant: 'destructive' });
    },
  });

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      const deviceToken = localStorage.getItem('device_token');
      signInMutation.mutate({ email, deviceToken: deviceToken || undefined });
    }
  };

  const handleMicrosoftSignIn = () => {
    if (!detectedDomain) return;
    window.location.href = `/api/auth/sso/microsoft/initiate?domain=${encodeURIComponent(detectedDomain)}`;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">

      {/* ── Left Panel ── */}
      <div className="relative w-full lg:w-1/2 flex flex-col h-full bg-white">

        {/* Teal accent bar on left edge */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0d4a47] via-[#1a8a82] to-[#0d4a47] z-10" />

        {/* Centred content area */}
        <div className="flex-1 flex items-center justify-center px-10 lg:px-20 py-10">
          <div className="w-full max-w-[420px]">

            {/* Logo row */}
            <div className="flex items-center gap-3 mb-10">
              <img
                src="/Images - Logo/PNGs/120px.png"
                alt="LedgerLM Logo"
                className="h-10 w-10 flex-shrink-0"
              />
              <span className="text-2xl font-bold text-foreground tracking-tight">LedgerLM</span>
            </div>

            {/* Headline */}
            <h1 className="text-[42px] font-bold leading-[1.15] tracking-tight text-foreground mb-8">
              Turn Financial Data<br />
              <span className="text-[#1a6b66]">into Clarity.</span>
            </h1>

            {/* Divider */}
            <div className="w-12 h-1 rounded-full bg-[#1a6b66] mb-8" />

            {/* Form card */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-7 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Sign in
              </p>
              <p className="text-sm text-muted-foreground mb-5">
                Enter your work email address to get started
              </p>

              <form
                onSubmit={isSsoEnabled ? (e) => { e.preventDefault(); handleMicrosoftSignIn(); } : handleContinue}
                className="space-y-3"
              >
                <Input
                  type="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-sm bg-white border-gray-300 placeholder:text-gray-400 focus:border-[#1a6b66] focus:ring-[#1a6b66]"
                  required
                  autoFocus
                  data-testid="input-email"
                />

                {isSsoEnabled ? (
                  <Button
                    type="submit"
                    className="w-full h-12 text-sm font-semibold flex items-center justify-center gap-2.5"
                    disabled={!email || isResolvingAuthMethod}
                    data-testid="button-microsoft-signin"
                  >
                    <MicrosoftIcon />
                    Continue with Microsoft
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold"
                    disabled={!email || signInMutation.isPending || isResolvingAuthMethod}
                    data-testid="button-signin"
                  >
                    {isResolvingAuthMethod
                      ? 'Checking…'
                      : signInMutation.isPending
                      ? 'Sending code…'
                      : 'Continue with email'}
                    {!isResolvingAuthMethod && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Footer — trust badges */}
        <div className="px-10 lg:px-20 py-4 border-t border-gray-100">
          <div className="flex items-center gap-6 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1a6b66]" />
              Enterprise Grade
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#1a6b66]" />
              End-to-End Encrypted
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#1a6b66]" />
              ISO 27001
            </span>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <NetworkBackground theme="teal" />

        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-16">
          <div className="max-w-lg text-center">

            {/* Decorative quote */}
            <div
              className="text-[100px] leading-none font-serif text-white/10 select-none mb-[-28px]"
              aria-hidden="true"
            >
              &ldquo;
            </div>

            {/* Carousel text with fade */}
            <p
              className="text-2xl font-light text-white leading-relaxed"
              style={{
                opacity: fadeIn ? 1 : 0,
                transition: 'opacity 350ms ease-in-out',
              }}
            >
              {CAROUSEL_SLIDES[slideIndex]}
            </p>

            {/* Animated dots */}
            <div className="flex items-center justify-center gap-2 mt-10">
              {CAROUSEL_SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setFadeIn(false);
                    setTimeout(() => { setSlideIndex(i); setFadeIn(true); }, 350);
                  }}
                  className={`rounded-full transition-all duration-300 ${
                    i === slideIndex
                      ? 'w-6 h-2 bg-white'
                      : 'w-2 h-2 bg-white/35 hover:bg-white/60'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                  data-testid={`pagination-dot-${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
