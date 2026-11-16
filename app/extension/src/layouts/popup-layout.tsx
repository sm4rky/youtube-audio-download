import { useNavigationStore } from '../stores/navigation.store.ts';
import type { ReactNode } from 'react';
import { Header } from '../components/header.tsx';

export function PopupLayout({ children }: { children: ReactNode }) {
  const view = useNavigationStore((state) => state.view);
  return (
    <div className="flex h-[600px] w-full flex-col overflow-clip bg-[radial-gradient(ellipse_at_15%_0%,#e9995438,transparent_55%),linear-gradient(165deg,#fbf3e7,#f5e6ce)] px-6 pt-3 pb-6 text-[#2a1a11]">
      <Header onBack={view === 'song-details' ? () => useNavigationStore.getState().setView('search-results') : undefined} />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
