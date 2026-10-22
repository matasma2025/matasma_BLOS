import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthLayout } from '@/components/AuthLayout';
import { OtpPromoPanel } from '@/components/OtpPromoPanel';
import { ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { setAuthUser } from '@/lib/auth';
import {
  activatePendingDeviceCredential,
  prepareDeviceRegistration,
  setDeviceCredentialId,
} from '@/lib/deviceProof';

interface AuthResponse {
  success: boolean;
  requiresOtp?: boolean;
  user?: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  };
  deviceCredentialId?: string;
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

function signInErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const body = raw.replace(/^\d+:\s*/, '');

  try {
    const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
    const serverMessage =
      typeof parsed.error === 'string'
        ? parsed.error
        : typeof parsed.message === 'string'
          ? parsed.message
          : '';

    if (/no account found/i.test(serverMessage)) {
      return 'No LedgerLM account was found for this email. Please contact your administrator.';
    }
    if (/sso_required/i.test(serverMessage)) {
      return 'This domain uses Microsoft sign-in. Please use the Microsoft sign-in option.';
    }
    if (/device registration challenge expired/i.test(serverMessage)) {
      return 'The secure sign-in request expired. Please click Continue with email once.';
    }
    if (/invalid registration proof/i.test(serverMessage)) {
      return 'The secure sign-in request could not be verified. Please try again once.';
    }
  } catch {
    // Keep the safe generic message for non-JSON errors.
  }

  return 'Please check the email address or contact your administrator.';
}

export default function Welcome() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [email, setEmail] = useState('');
  const [detectedDomain, setDetectedDomain] = useState('');
  const [isPreparingDeviceRegistration, setIsPreparingDeviceRegistration] = useState(false);
  const { toast } = useToast();

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
    mutationFn: async (data: { email: string; deviceRegistration: Awaited<ReturnType<typeof prepareDeviceRegistration>> }) =>
      apiRequest<AuthResponse>('POST', '/api/auth/signin', data),
    onSuccess: async (data, variables) => {
      if (data.requiresOtp) {
        sessionStorage.setItem('otp_email', variables.email);
        toast({ title: 'Verification required', description: "We've sent a verification code to your email." });
        setLocation('/verify-otp');
      } else if (data.user) {
        if (data.deviceCredentialId) {
          await setDeviceCredentialId(data.deviceCredentialId);
        }
        setAuthUser(data.user);
        queryClient.clear();
        setLocation('/dashboard');
      }
    },
    onError: (error) => {
      toast({ title: 'Sign in failed', description: signInErrorMessage(error), variant: 'destructive' });
    },
  });

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isPreparingDeviceRegistration || signInMutation.isPending) return;

    setIsPreparingDeviceRegistration(true);
    try {
      localStorage.removeItem('device_token');
      const deviceRegistration = await prepareDeviceRegistration({ rotate: true });
      signInMutation.mutate({ email, deviceRegistration });
    } catch {
      toast({ title: 'Secure sign in unavailable', description: 'This browser cannot create a device key.', variant: 'destructive' });
    } finally {
      setIsPreparingDeviceRegistration(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    if (!detectedDomain || isPreparingDeviceRegistration) return;

    setIsPreparingDeviceRegistration(true);
    try {
      const deviceRegistration = await prepareDeviceRegistration({ rotate: true });
      const result = await apiRequest<{ initiateUrl: string }>('POST', '/api/auth/sso/microsoft/prepare', {
        domain: detectedDomain, deviceRegistration,
      });
      await activatePendingDeviceCredential();
      window.location.href = result.initiateUrl;
    } catch {
      toast({ title: 'Sign in failed', description: 'Unable to start Microsoft sign in.', variant: 'destructive' });
    } finally {
      setIsPreparingDeviceRegistration(false);
    }
  };

  return (
    <AuthLayout
      variant="otp"
      rightPanelContent={<OtpPromoPanel dotTestIdPrefix="pagination-dot" />}
    >
      <div className="w-full">
        <h2 className="mb-7 text-center text-[16px] font-semibold tracking-[-0.015em] text-[#1a292a]">
          Sign in
        </h2>
        <form
          onSubmit={
            isSsoEnabled
              ? (e) => {
                  e.preventDefault();
                  handleMicrosoftSignIn();
                }
              : handleContinue
          }
          className="space-y-5"
        >
          <div className="space-y-2">
            <label htmlFor="welcome-email" className="block text-[12px] font-medium text-[#263638]">
              Enter your work email to get started:
            </label>
            <Input
              id="welcome-email"
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[42px] rounded-[7px] border-[#dce4e3] bg-white px-3 text-[13px] text-[#172c2d] shadow-[0_2px_7px_rgba(12,47,49,0.04)] placeholder:text-[#aab4b3] focus-visible:border-[#3c9294] focus-visible:ring-[#3c9294]/20"
              required
              autoFocus
              data-testid="input-email"
            />
          </div>

          {isSsoEnabled ? (
            <Button
              type="submit"
              className="flex h-[42px] w-full items-center justify-center gap-2.5 rounded-[7px] bg-[#3d8589] text-[13px] font-medium text-white hover:bg-[#32777b] disabled:opacity-100"
              disabled={!email || isResolvingAuthMethod || isPreparingDeviceRegistration}
              data-testid="button-microsoft-signin"
            >
              <MicrosoftIcon />
              Continue with Microsoft
            </Button>
          ) : (
            <Button
              type="submit"
              className="h-[42px] w-full rounded-[7px] bg-[#3d8589] text-[13px] font-medium text-white shadow-[0_2px_5px_rgba(12,62,64,0.12)] hover:bg-[#32777b] disabled:opacity-100"
              disabled={!email || signInMutation.isPending || isResolvingAuthMethod || isPreparingDeviceRegistration}
              data-testid="button-signin"
            >
              {isResolvingAuthMethod
                ? 'Checking…'
                : isPreparingDeviceRegistration
                  ? 'Securing sign-in…'
                  : signInMutation.isPending
                    ? 'Sending code…'
                    : 'Continue with email'}
              {!isResolvingAuthMethod && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          )}
        </form>
      </div>
    </AuthLayout>
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
