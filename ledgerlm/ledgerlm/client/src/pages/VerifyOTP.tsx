import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/AuthLayout';
import { OtpPromoPanel } from '@/components/OtpPromoPanel';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { setAuthUser } from '@/lib/auth';
import { activatePendingDeviceCredential, setDeviceCredentialId } from '@/lib/deviceProof';

export default function VerifyOTP() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const { toast } = useToast();

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('otp_email');
    if (!storedEmail) {
      setLocation('/');
      return;
    }
    setEmail(storedEmail);

    const timer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

  const verifyMutation = useMutation({
    mutationFn: async (data: { email: string; otpCode: string }) => {
      return await apiRequest<{
        success: boolean;
        user: any;
        deviceCredentialId?: string;
      }>('POST', '/api/auth/verify-otp', data);
    },
    onSuccess: async (data) => {
      if (data.user) {
        setAuthUser(data.user);
        queryClient.clear();
        if (data.deviceCredentialId) {
          await setDeviceCredentialId(data.deviceCredentialId);
        } else {
          await activatePendingDeviceCredential();
        }
      }
      localStorage.removeItem('device_token');
      sessionStorage.removeItem('otp_email');
      toast({
        title: 'Verification successful',
        description: 'Welcome to LedgerLM!',
      });
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      toast({
        title: 'Verification failed',
        description: error.message || 'Invalid or expired code. Please try again.',
        variant: 'destructive',
      });
      setCode('');
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/auth/resend-otp', { email });
    },
    onSuccess: () => {
      toast({
        title: 'Code sent',
        description: 'A new verification code has been sent to your email.',
      });
      setCanResend(false);
      setResendCountdown(60);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to resend code',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      verifyMutation.mutate({ email, otpCode: code });
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  const handleBack = () => {
    sessionStorage.removeItem('otp_email');
    setLocation('/');
  };

  return (
    <AuthLayout variant="otp" rightPanelContent={<OtpPromoPanel />}>
      <div className="space-y-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 shrink-0 text-[#317f80]" />
            <h1 className="text-[23px] font-semibold tracking-[-0.035em] text-[#172426] sm:text-[26px]">
              Verify Your Identity
            </h1>
          </div>
          <p className="text-[13px] leading-relaxed text-[#677775]">
            We've sent a 6-digit verification code to{' '}
            <strong className="block break-all font-semibold text-[#253b3a]" data-testid="text-otp-email">{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="code" className="text-[12px] font-medium text-[#263638]">
              Verification Code
            </Label>
            <div className="group relative flex h-[52px] w-full items-center justify-center gap-2 sm:gap-2.5" data-testid="otp-six-slots">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 sm:gap-2.5" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <span
                    key={index}
                    className="flex h-[48px] min-w-0 flex-1 max-w-[52px] items-center justify-center rounded-[7px] border border-[#dce4e3] bg-[#fbfdfc] font-mono text-[21px] font-medium text-[#203b3a] shadow-[0_2px_7px_rgba(12,47,49,0.035)] transition-colors group-focus-within:border-[#3c9294] group-focus-within:bg-white"
                    data-testid={`otp-slot-${index + 1}`}
                  >
                    {code[index] || <span className="text-[#c5d0ce]">0</span>}
                  </span>
                ))}
              </div>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder=""
                value={code}
                onChange={handleCodeChange}
                maxLength={6}
                className="absolute inset-0 z-10 h-full w-full cursor-text border-0 bg-transparent p-0 text-center font-mono text-[22px] tracking-[2.2em] text-transparent caret-transparent opacity-0 shadow-none focus-visible:ring-2 focus-visible:ring-[#3c9294]/35 focus-visible:ring-offset-2"
                autoComplete="one-time-code"
                autoFocus
                aria-label="Six-digit verification code"
                data-testid="input-otp-code"
              />
            </div>
            <p className="text-xs text-[#71817f]">

            </p>
          </div>

          <Button
            type="submit"
            className="h-10 w-full rounded-[7px] bg-[#3d8589] text-[13px] font-medium text-white shadow-[0_2px_5px_rgba(12,62,64,0.12)] hover:bg-[#32777b]"
            disabled={code.length !== 6 || verifyMutation.isPending}
            data-testid="button-verify"
          >
            {verifyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Code'
            )}
          </Button>

          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-[11px] text-[#81908e]">
                  Didn't receive the code?
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-9 w-full rounded-[7px] border-[#dce4e3] text-[13px]"
              onClick={() => resendMutation.mutate()}
              disabled={!canResend || resendMutation.isPending}
              data-testid="button-resend"
            >
              {resendMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : canResend ? (
                'Resend Code'
              ) : (
                `Resend in ${resendCountdown}s`
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="h-8 w-full text-[13px] text-[#526462] hover:text-[#1c4242]"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
