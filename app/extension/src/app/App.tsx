import { LoadingScreen } from '../screens/loading-screen.tsx';
import { PopupLayout } from '../layouts/popup-layout.tsx';

export default function App() {
  return (
    <PopupLayout>
      <LoadingScreen />
    </PopupLayout>
  );
}
