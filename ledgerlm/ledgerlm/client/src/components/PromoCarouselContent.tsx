import { useEffect, useState } from 'react';

const stories = [
  {
    title: 'Goal Seek AI',
    description: 'In-built financial context and goal-seek AI to check for scenarios & simulation',
    kind: 'goal',
  },
  {
    title: 'Agents for action',
    description: 'Agents to organise and execute tasks run based on context and expected outcomes',
    kind: 'agents',
  },
  {
    title: 'Conversational Finance',
    description: 'All data connected to one system, and lean UI to access anything finance team needs.',
    kind: 'finance',
  },
] as const;

interface PromoCarouselContentProps {
  dotTestIdPrefix: string;
  rotationIntervalMs?: number;
  className?: string;
}

export function PromoCarouselContent({
  dotTestIdPrefix,
  rotationIntervalMs = 5200,
  className = '',
}: PromoCarouselContentProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setActive((index) => (index + 1) % stories.length),
      rotationIntervalMs,
    );
    return () => window.clearInterval(timer);
  }, [rotationIntervalMs]);

  const story = stories[active];

  return (
    <div className={`relative z-10 flex h-full w-full flex-col items-center px-6 pb-7 pt-7 sm:px-10 sm:pb-9 md:px-7 lg:px-11 ${className}`}>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {story.kind === 'goal' ? (
          <GoalSeekIllustration />
        ) : story.kind === 'agents' ? (
          <AgentIllustration />
        ) : (
          <FinanceIllustration />
        )}
      </div>
      <div className="w-full max-w-[470px]">
        <div className="transition-opacity duration-300" aria-live="polite">
          <h2 className="mb-2 text-[20px] font-semibold tracking-[-0.025em] text-[#f5fbfa] sm:text-[22px]">
            {story.title}
          </h2>
          <p className="max-w-[440px] text-[14px] leading-[1.55] text-[#d5e9e7] sm:text-[15px]">
            {story.description}
          </p>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2" role="group" aria-label="Choose product story">
          {stories.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => setActive(index)}
              className={`h-[7px] rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a5e4df] ${active === index ? 'w-[22px] bg-[#d9f5f1]' : 'w-[7px] bg-[#a8ceca]/55 hover:bg-[#d9f5f1]/80'}`}
              aria-label={`Show ${item.title}`}
              aria-current={active === index ? 'true' : undefined}
              data-testid={`${dotTestIdPrefix}-${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalSeekIllustration() {
  return (
    <svg viewBox="0 0 480 360" className="h-auto max-h-[min(52vh,420px)] w-full max-w-[520px]" role="img" aria-label="Connected financial goals">
      <defs>
        <radialGradient id="promo-node" cx="35%" cy="25%">
          <stop offset="0" stopColor="#e5fff7" />
          <stop offset="1" stopColor="#72d6ce" />
        </radialGradient>
        <linearGradient id="promo-center" x2="0" y2="1">
          <stop stopColor="#299a9b" />
          <stop offset="1" stopColor="#126b70" />
        </linearGradient>
      </defs>
      <circle cx="240" cy="170" r="116" fill="none" stroke="#72d6ce" strokeWidth="3" strokeDasharray="2 10" opacity=".7" />
      <g stroke="#79d8d1" strokeWidth="3" opacity=".8">
        <path d="M240 66v66M313 95l-47 47M344 170h-66M313 245l-47-47M240 274v-66M167 245l47-47M136 170h66M167 95l47 47" />
      </g>
      <rect x="185" y="115" width="110" height="110" rx="24" fill="url(#promo-center)" stroke="#79d8d1" strokeWidth="3" />
      <circle cx="240" cy="170" r="34" fill="none" stroke="#e3fff7" strokeWidth="7" />
      <circle cx="240" cy="170" r="21" fill="none" stroke="#e3fff7" strokeWidth="6" />
      <circle cx="240" cy="170" r="7" fill="#e3fff7" />
      <path d="M232 178l29-29 17 4M278 153v-11h-11" fill="none" stroke="#e3fff7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {[[240, 54], [326, 84], [356, 170], [326, 256], [240, 286], [154, 256], [124, 170], [154, 84]].map(([cx, cy], index) => (
        <circle key={index} cx={cx} cy={cy} r="17" fill="url(#promo-node)" stroke="#8ee8df" strokeWidth="3" />
      ))}
      <circle cx="240" cy="170" r="138" fill="none" stroke="#65c9c2" strokeWidth="1" opacity=".24" />
    </svg>
  );
}

function AgentIllustration() {
  return (
    <svg viewBox="0 0 480 360" className="h-auto max-h-[min(52vh,420px)] w-full max-w-[520px]" role="img" aria-label="Financial documents linked by an AI agent">
      <defs>
        <linearGradient id="promo-doc" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e4fff6" />
          <stop offset="1" stopColor="#8bd8ce" />
        </linearGradient>
        <linearGradient id="promo-doc-dark" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#3bb2ad" />
          <stop offset="1" stopColor="#117177" />
        </linearGradient>
      </defs>
      <path d="M111 241c38 50 78 47 111 2 32-44 61-53 119-20" fill="none" stroke="#78d8d1" strokeWidth="3" strokeDasharray="3 9" />
      <path d="M122 107h89l35 35v108a12 12 0 0 1-12 12h-112a12 12 0 0 1-12-12V119a12 12 0 0 1 12-12z" fill="url(#promo-doc)" stroke="#9de9dd" strokeWidth="3" />
      <path d="M211 107v28a8 8 0 0 0 8 8h27" fill="#c2f4e9" stroke="#9de9dd" strokeWidth="3" />
      <g stroke="#3aa4a1" strokeWidth="5" strokeLinecap="round">
        <path d="M145 171h54M145 193h42M145 215h31" />
      </g>
      <path d="M267 91h86l31 31v102a12 12 0 0 1-12 12h-105a12 12 0 0 1-12-12V103a12 12 0 0 1 12-12z" fill="url(#promo-doc-dark)" stroke="#72d8d0" strokeWidth="3" />
      <path d="M353 91v25a8 8 0 0 0 8 8h23" fill="#5ec7c0" stroke="#72d8d0" strokeWidth="3" />
      <path d="M289 153l30 17 28-32" fill="none" stroke="#b5fff2" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="319" cy="170" r="8" fill="#e0fff7" />
      <circle cx="319" cy="170" r="26" fill="none" stroke="#a7eee3" strokeWidth="2" opacity=".5" />
      <circle cx="319" cy="170" r="42" fill="none" stroke="#a7eee3" strokeWidth="1.5" opacity=".25" />
    </svg>
  );
}

function FinanceIllustration() {
  return (
    <svg viewBox="0 0 480 360" className="h-auto max-h-[min(52vh,420px)] w-full max-w-[520px]" role="img" aria-label="Connected financial reports and trend">
      <defs>
        <linearGradient id="promo-finance-card-a" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#42b2b3" />
          <stop offset="1" stopColor="#0b6870" />
        </linearGradient>
        <linearGradient id="promo-finance-card-b" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d7f3ec" />
          <stop offset="1" stopColor="#6cc9bf" />
        </linearGradient>
      </defs>
      <rect x="55" y="54" width="205" height="166" rx="20" fill="url(#promo-finance-card-a)" stroke="#80d5d1" strokeWidth="3" />
      <path d="M88 169l39-42 30 23 48-59" fill="none" stroke="#c9f4ed" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="88" cy="169" r="8" fill="#d5f7f1" />
      <circle cx="157" cy="150" r="8" fill="#d5f7f1" />
      <circle cx="205" cy="91" r="9" fill="#d5f7f1" />
      <path d="M239 105h47c25 0 41 17 41 42v14" fill="none" stroke="#73d8d1" strokeWidth="5" strokeLinecap="round" />
      <rect x="218" y="178" width="190" height="174" rx="20" fill="url(#promo-finance-card-b)" stroke="#a3e4dc" strokeWidth="3" />
      <g fill="#8acfc6" opacity=".8">
        <circle cx="252" cy="211" r="4" /><circle cx="272" cy="211" r="4" /><circle cx="292" cy="211" r="4" /><circle cx="312" cy="211" r="4" />
        <circle cx="252" cy="232" r="4" /><circle cx="272" cy="232" r="4" /><circle cx="292" cy="232" r="4" /><circle cx="312" cy="232" r="4" />
        <circle cx="252" cy="253" r="4" /><circle cx="272" cy="253" r="4" /><circle cx="292" cy="253" r="4" /><circle cx="312" cy="253" r="4" />
      </g>
      <circle cx="365" cy="229" r="17" fill="#187b7c" />
      <path d="M161 254v17c0 26 21 47 47 47h58c31 0 51-16 73-37l23-23" fill="none" stroke="#63c9c2" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M208 318h58c31 0 51-16 73-37l23-23" fill="none" stroke="#e0fbf5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <text x="326" y="325" fill="#f3fffc" fontFamily="Inter, sans-serif" fontSize="34" fontWeight="700">24%</text>
    </svg>
  );
}
