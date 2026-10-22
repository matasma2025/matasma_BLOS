import { useEffect, useState, type FormEvent } from 'react';
import './_group.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight } from 'lucide-react';

const CAROUSEL_SLIDES = [
  {
    title: 'Conversational Finance',
    description: 'All data connected to one system, and lean UI to access anything finance team needs.',
  },
  {
    title: 'Answers, in context',
    description: 'Ask questions in plain language and get instant answers from your financial data—no SQL, no exports.',
  },
  {
    title: 'Built for confidence',
    description: 'Enterprise-grade security with Microsoft SSO, role-based access, and full audit logging built in.',
  },
];

async function mockApiRequest(_path: string, _payload: { email: string }) {
  return { success: true };
}

function mockToast(_message: string) {}

function mockNavigate(_path: string) {}

export function ReferenceMatch() {
  const [email, setEmail] = useState('');
  const [slideIndex, setSlideIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [isPreparingDeviceRegistration, setIsPreparingDeviceRegistration] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const isSsoEnabled = false;
  const isResolvingAuthMethod = false;

  useEffect(() => {
    const timer = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setSlideIndex((i) => (i + 1) % CAROUSEL_SLIDES.length);
        setFadeIn(true);
      }, 350);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const selectSlide = (index: number) => {
    setFadeIn(false);
    setTimeout(() => {
      setSlideIndex(index);
      setFadeIn(true);
    }, 350);
  };

  const handleContinue = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || isPreparingDeviceRegistration || isSending) return;

    setIsPreparingDeviceRegistration(true);
    try {
      setIsSending(true);
      await mockApiRequest('/api/auth/signin', { email });
      mockToast('Sign-in submitted');
      mockNavigate('/verify-otp');
    } catch {
      mockToast('Sign in failed');
    } finally {
      setIsSending(false);
      setIsPreparingDeviceRegistration(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    if (!email || isPreparingDeviceRegistration) return;
    setIsPreparingDeviceRegistration(true);
    try {
      await mockApiRequest('/api/auth/sso/microsoft/prepare', { email });
      mockToast('Microsoft sign-in submitted');
      mockNavigate('/dashboard');
    } catch {
      mockToast('Sign in failed');
    } finally {
      setIsPreparingDeviceRegistration(false);
    }
  };

  const slide = CAROUSEL_SLIDES[slideIndex];

  return (
    <main className="min-h-[100dvh] w-full bg-[#f8faf9] text-[#172c2d]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1600px] flex-col bg-white lg:flex-row">
        <section className="relative flex min-h-[650px] w-full flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:min-h-[100dvh] lg:w-1/2 lg:items-start lg:px-16 lg:pt-[17vh] xl:px-24">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="mb-7 flex items-center gap-3">
              <img
                src="/__mockup/images/ledgerlm-logo.png"
                alt="LedgerLM"
                className="h-10 w-10 shrink-0 rounded-[5px]"
              />
              <span className="font-['Inter'] text-[27px] font-semibold tracking-[-0.04em] text-[#103d40]">
                LedgerLM
              </span>
            </div>

            <h1 className="mb-28 max-w-[440px] font-['Inter'] text-[34px] font-medium leading-[1.24] tracking-[-0.035em] text-[#172426] sm:text-[39px]">
              Turn Financial Data
              <br />
              <span className="pl-7 sm:pl-8">into Decisions</span>
            </h1>

            <div className="w-full">
              <h2 className="mb-7 text-center font-['Inter'] text-[16px] font-semibold tracking-[-0.015em] text-[#1a292a]">
                Sign in or register
              </h2>
              <form
                onSubmit={isSsoEnabled ? (e) => { e.preventDefault(); handleMicrosoftSignIn(); } : handleContinue}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label htmlFor="ledger-email" className="block text-[12px] font-medium text-[#263638]">
                    Sign in with email:
                  </label>
                  <Input
                    id="ledger-email"
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
                    className="h-[42px] w-full rounded-[7px] bg-[#3d8589] text-[13px] font-medium text-white hover:bg-[#32777b] disabled:opacity-100"
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
                    disabled={!email || isSending || isResolvingAuthMethod || isPreparingDeviceRegistration}
                    data-testid="button-signin"
                  >
                    {isResolvingAuthMethod
                      ? 'Checking…'
                      : isPreparingDeviceRegistration
                        ? 'Securing sign-in…'
                        : isSending
                          ? 'Sending code…'
                          : 'Continue with email'}
                    {!isResolvingAuthMethod && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                )}
              </form>
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center px-4 pb-5 sm:px-8 sm:pb-8 lg:w-1/2 lg:p-8">
          <div className="relative flex min-h-[570px] w-full max-w-[650px] flex-col items-center overflow-hidden rounded-[27px] bg-[#073f42] px-7 pb-8 pt-8 text-white sm:min-h-[640px] sm:rounded-[32px] sm:px-11 sm:pb-10 sm:pt-12 lg:min-h-[calc(100dvh-64px)]">
            <div className="pointer-events-none absolute inset-0 opacity-[0.13]" aria-hidden="true">
              <svg className="h-full w-full" viewBox="0 0 700 900" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <pattern id="ledger-grid" width="64" height="64" patternUnits="userSpaceOnUse">
                    <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#b7e3df" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="700" height="900" fill="url(#ledger-grid)" />
              </svg>
            </div>

            <FinanceIllustration />

            <div className="relative z-10 mt-auto w-full max-w-[490px] pt-7 sm:pt-10">
              <div
                className="transition-opacity duration-300"
                style={{ opacity: fadeIn ? 1 : 0 }}
                aria-live="polite"
              >
                <h2 className="mb-2 text-[20px] font-semibold tracking-[-0.025em] text-[#f5fbfa] sm:text-[21px]">
                  {slide.title}
                </h2>
                <p className="max-w-[465px] text-[14px] leading-[1.55] text-[#d5e9e7] sm:text-[15px]">
                  {slide.description}
                </p>
              </div>
              <div className="mt-8 flex items-center justify-center gap-[7px]" role="group" aria-label="Choose slide">
                {CAROUSEL_SLIDES.map((item, i) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => selectSlide(i)}
                    className={`h-[7px] rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a5e4df] ${
                      i === slideIndex ? 'w-[22px] bg-[#d9f5f1]' : 'w-[7px] bg-[#a8ceca]/45 hover:bg-[#d9f5f1]/75'
                    }`}
                    aria-label={`Slide ${i + 1}`}
                    aria-current={i === slideIndex ? 'true' : undefined}
                    data-testid={`pagination-dot-${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function FinanceIllustration() {
  return (
    <div className="relative z-10 flex min-h-[315px] w-full flex-1 items-center justify-center sm:min-h-[380px]" aria-hidden="true">
      <svg viewBox="0 0 530 390" className="h-auto w-full max-w-[500px] overflow-visible">
        <defs>
          <linearGradient id="panelOne" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#42b2b3" />
            <stop offset="1" stopColor="#0b6870" />
          </linearGradient>
          <linearGradient id="panelTwo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d7f3ec" />
            <stop offset="1" stopColor="#6cc9bf" />
          </linearGradient>
          <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#001e21" floodOpacity=".32" />
          </filter>
          <filter id="lightGlow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <g filter="url(#cardShadow)">
          <rect x="64" y="47" width="214" height="175" rx="20" fill="url(#panelOne)" stroke="#80d5d1" strokeWidth="3" />
          <path d="M93 172l42-45 27 21 52-61" fill="none" stroke="#c9f4ed" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="93" cy="172" r="8" fill="#d5f7f1" />
          <circle cx="162" cy="148" r="8" fill="#d5f7f1" />
          <circle cx="214" cy="87" r="9" fill="#d5f7f1" />
          <path d="M259 105h47c26 0 42 17 42 43v12" fill="none" stroke="#73d8d1" strokeWidth="5" strokeLinecap="round" />

          <rect x="231" y="181" width="195" height="178" rx="20" fill="url(#panelTwo)" stroke="#a3e4dc" strokeWidth="3" />
          <g fill="#8acfc6" opacity=".8">
            <circle cx="266" cy="216" r="4" /><circle cx="286" cy="216" r="4" /><circle cx="306" cy="216" r="4" /><circle cx="326" cy="216" r="4" />
            <circle cx="266" cy="237" r="4" /><circle cx="286" cy="237" r="4" /><circle cx="306" cy="237" r="4" /><circle cx="326" cy="237" r="4" />
            <circle cx="266" cy="258" r="4" /><circle cx="286" cy="258" r="4" /><circle cx="306" cy="258" r="4" /><circle cx="326" cy="258" r="4" />
          </g>
          <circle cx="383" cy="232" r="17" fill="#187b7c" />
          <circle cx="383" cy="232" r="9" fill="#0b4f54" />
          <path d="M155 252v22c0 25 20 45 45 45h77c28 0 50-16 68-34l38-39" fill="none" stroke="#63c9c2" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M200 319h77c28 0 50-16 68-34l38-39" fill="none" stroke="#e0fbf5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="345" cy="288" r="16" fill="#70e5da" opacity=".7" filter="url(#lightGlow)" />
          <circle cx="345" cy="288" r="7" fill="#e6fff7" />
          <text x="333" y="329" fill="#f3fffc" fontFamily="Inter, sans-serif" fontSize="35" fontWeight="700">24%</text>
        </g>
      </svg>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
