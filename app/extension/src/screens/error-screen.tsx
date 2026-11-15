import type { LucideIcon } from 'lucide-react';
import { Button } from '../components/ui/button.tsx';

interface ErrorScreenProps {
  icon: LucideIcon;
  title: string;
  description: string;
  retryLabel: string;
  onRetry(): void;
}

export function ErrorScreen({ icon: Icon, title, description, retryLabel, onRetry }: ErrorScreenProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center pb-8 text-center" aria-labelledby="error-heading">
      <div className="flex size-[118px] items-center justify-center rounded-full bg-[#d97439]/10 text-[#b76535] ring-1 ring-[#d97439]/15" aria-hidden="true">
        <Icon className="size-11" strokeWidth={1.3} />
      </div>
      <div className="mt-6 max-w-[260px]" role="alert">
        <h1 id="error-heading" className="text-[20px] leading-tight font-medium tracking-[-0.015em]">
          {title}
        </h1>
        <p className="mt-2 text-[11.5px] leading-[1.55] text-[#2a1a11]/60">
          {description}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        className="mt-5 h-9 cursor-pointer rounded-full border-[#2a1a11]/12 bg-[#fff3df] px-4 text-xs text-[#713e23] hover:bg-[#efd9b9] focus-visible:ring-[#d97439]/25"
      >
        {retryLabel}
      </Button>
    </section>
  );
}
