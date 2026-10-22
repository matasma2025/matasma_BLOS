import { PromoCarouselContent } from '@/components/PromoCarouselContent';

interface OtpPromoPanelProps {
  dotTestIdPrefix?: string;
  rotationIntervalMs?: number;
}

export function OtpPromoPanel({
  dotTestIdPrefix = 'otp-promo-dot',
  rotationIntervalMs = 5200,
}: OtpPromoPanelProps) {
  return (
    <div className="relative flex h-full min-h-[390px] w-full items-center justify-center overflow-hidden rounded-[24px] bg-[#073f42] text-white md:min-h-0 md:rounded-[28px]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.13]" aria-hidden="true">
        <svg className="h-full w-full" viewBox="0 0 700 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="otp-panel-grid" width="64" height="64" patternUnits="userSpaceOnUse">
              <path d="M64 0H0V64" fill="none" stroke="#b7e3df" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="700" height="900" fill="url(#otp-panel-grid)" />
        </svg>
      </div>

      <PromoCarouselContent
        dotTestIdPrefix={dotTestIdPrefix}
        rotationIntervalMs={rotationIntervalMs}
      />
    </div>
  );
}
