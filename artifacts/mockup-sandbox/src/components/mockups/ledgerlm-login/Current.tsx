import { useEffect, useRef, useState, type FormEvent } from 'react';
import './_group.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ShieldCheck, Lock, Globe } from 'lucide-react';

const CAROUSEL_SLIDES = [
  'Connect, analyze, and summarize financial reports, balance sheets, and audits—all in one secure workspace.',
  'Ask questions in plain language and get instant answers from your financial data—no SQL, no exports.',
  'Enterprise-grade security with Microsoft SSO, role-based access, and full audit logging built in.',
];

// Local-only stand-ins keep this extracted visual safe to interact with in the sandbox.
async function mockApiRequest(_path: string, _payload: { email: string }) {
  return { success: true };
}

function mockToast(_message: string) {}

function mockNavigate(_path: string) {}

export function Current() {
  const [email, setEmail] = useState('');
  const [slideIndex, setSlideIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [isPreparingDeviceRegistration, setIsPreparingDeviceRegistration] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // The original page resolves this from an API; the visual baseline defaults to email sign-in.
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
                src="/__mockup/images/ledgerlm-logo.png"
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
                    disabled={!email || isResolvingAuthMethod || isPreparingDeviceRegistration}
                    data-testid="button-microsoft-signin"
                  >
                    <MicrosoftIcon />
                    Continue with Microsoft
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold"
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

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

function NetworkBackground({ theme = 'dark' }: { theme?: 'dark' | 'teal' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const nodes: Node[] = [];
    const nodeCount = 40;
    const maxDistance = 150;

    const bgColor = theme === 'teal' ? '#0D4946' : '#1A1A1A';
    const primaryColor = theme === 'teal' ? '#3B9B96' : '#2D5F5D';
    const accentColor = '#EC407A';

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        color: i % 3 === 0 ? accentColor : primaryColor,
      });
    }

    function animate() {
      if (!canvas || !ctx) return;

      const fadeColor = theme === 'teal' ? 'rgba(13, 73, 70, 0.1)' : 'rgba(26, 26, 26, 0.1)';
      ctx.fillStyle = fadeColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = nodes[i].color;
            ctx.globalAlpha = (1 - distance / maxDistance) * 0.15;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }

      requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [theme]);

  const bgColor = theme === 'teal' ? '#0D4946' : '#1A1A1A';

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: bgColor }}
    />
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
