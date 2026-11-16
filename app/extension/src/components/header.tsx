import { ArrowLeft, AudioLines, Settings } from 'lucide-react';
import { Button } from './ui/button.tsx';

export function Header({ onBack }: { onBack?: () => void }) {
  return (
    <header className="relative flex h-8 shrink-0 items-center justify-center">
      {onBack && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Back to search results"
          onClick={onBack}
          className="absolute size-8 cursor-pointer rounded-full text-[#2a1a11]/60 transition-[background-color,color,transform] duration-150 hover:bg-[#2a1a11]/8 hover:text-[#2a1a11] focus-visible:ring-[#2a1a11]/25 active:scale-90 active:bg-[#2a1a11]/15 motion-reduce:transform-none motion-reduce:transition-none -left-1"
        >
          <ArrowLeft className="size-[19px]!" strokeWidth={1.7} aria-hidden="true" />
        </Button>
      )}
      <div className="flex items-center gap-2.5 text-[#2a1a11]">
        <span className="flex size-7 items-center justify-center rounded-[9px] bg-[#d97439] text-[#fff3df] shadow-sm">
          <AudioLines className="size-[18px]" strokeWidth={2.3} aria-hidden="true" />
        </span>
        <span className="text-[21px] leading-none font-semibold tracking-[-0.8px]">
          AudioMint
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Settings"
        className="absolute size-8 cursor-pointer rounded-full text-[#2a1a11]/60 transition-[background-color,color,transform] duration-150 hover:bg-[#2a1a11]/8 hover:text-[#2a1a11] focus-visible:ring-[#2a1a11]/25 active:scale-90 active:bg-[#2a1a11]/15 motion-reduce:transform-none motion-reduce:transition-none group/settings -right-1"
      >
        <span
          className="pointer-events-none inline-flex transition-transform duration-500 ease-out motion-safe:group-hover/settings:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        >
          <Settings className="size-[19px]!" strokeWidth={1.7} />
        </span>
      </Button>
    </header>
  );
}
