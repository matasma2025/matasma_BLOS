import { NetworkBackground } from '@/components/NetworkBackground';
import { Logo } from '@/components/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
  rightPanelContent?: React.ReactNode;
  variant?: 'default' | 'otp';
}

export function AuthLayout({ children, rightPanelContent, variant = 'default' }: AuthLayoutProps) {
  const isOtp = variant === 'otp';
  return (
    <div className={`flex w-full ${isOtp ? 'min-h-[100dvh] flex-col overflow-y-auto bg-[#f5f8f7] md:flex-row md:overflow-hidden' : 'h-screen overflow-hidden'}`}>
      {/* Left Panel - White background with form */}
      <div className={`flex w-full items-center justify-center bg-white ${isOtp ? 'min-h-[100dvh] overflow-y-auto px-6 py-8 sm:px-10 md:min-h-0 md:w-1/2 md:px-8 md:py-3 lg:px-12' : 'p-8 lg:w-1/2'}`}>
        <div className={`w-full ${isOtp ? 'max-w-[390px]' : 'max-w-md space-y-8'}`}>
          {/* Logo and Tagline */}
          <div className={`flex items-center ${isOtp ? 'mb-8 gap-3' : 'gap-2'}`}>
            <img
              src="/Images - Logo/PNGs/120px.png"
              alt="LedgerLM Logo"
              className={isOtp ? 'h-[38px] w-[38px] shrink-0 rounded-[5px]' : 'h-8 w-9'}
            />
            <span className={isOtp ? 'text-[24px] font-bold tracking-[-0.03em] text-[#103d40]' : 'text-2xl font-bold text-foreground'}>
              LedgerLM
            </span>
          </div>

          {isOtp && (
            <h2 className="mb-10 max-w-[440px] text-[32px] font-bold leading-[1.1] tracking-[-0.035em] text-[#172426] sm:mb-12 sm:text-[38px]">
              Turn Financial Data
              <br />
              <span className="block text-[#1a6b66]">into Clarity.</span>
              <span className="mt-5 block h-[4px] w-11 rounded-full bg-[#1a6b66]" aria-hidden="true" />
            </h2>
          )}

          {children}
        </div>
      </div>

      {/* Right Panel - Dark teal network background */}
      <div className={`relative hidden overflow-hidden ${isOtp ? 'min-h-[430px] p-4 md:flex md:min-h-[100dvh] md:w-1/2 md:px-3 md:py-4' : 'lg:flex lg:w-1/2'}`}>
        {!isOtp && <NetworkBackground theme="teal" />}
        <div className={`relative z-10 flex h-full w-full flex-col items-center justify-center ${isOtp ? 'p-0' : 'p-12'}`}>
          {rightPanelContent || (
            <div className="max-w-md text-center space-y-6">
              <p className="text-xl text-white leading-relaxed">
                Connect, analyze, and summarize financial reports, balance sheets,
                and audits—all in one secure workspace.
              </p>
              <div className="flex items-center justify-center gap-2 pt-4">
                <div className="w-2 h-2 rounded-full bg-white" data-testid="pagination-dot-1"></div>
                <div className="w-2 h-2 rounded-full bg-white/40" data-testid="pagination-dot-2"></div>
                <div className="w-2 h-2 rounded-full bg-white/40" data-testid="pagination-dot-3"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
