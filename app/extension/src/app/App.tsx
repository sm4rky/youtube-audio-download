import { usePopupSession } from '../hooks/use-popup-session.ts';
import { PopupLayout } from '../layouts/popup-layout.tsx';
import { ViewResolver } from './view-resolver.tsx';

export default function App() {
  const { initialized, retrySource } = usePopupSession();

  return (
    <PopupLayout>
      {initialized ? <ViewResolver onRetrySource={retrySource} /> : null}
    </PopupLayout>
  );
}
