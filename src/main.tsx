import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { BattrickAuthProvider } from './lib/battrickAuthContext';
import './index.css';
import './fixtureOpponentIdNormalize';

// Intercept localStorage writes/removes to track local modifications and avoid race conditions with incoming Firestore snapshots
const originalSetItem = localStorage.setItem.bind(localStorage);
const originalRemoveItem = localStorage.removeItem.bind(localStorage);

localStorage.setItem = (key: string, value: string) => {
  if (!(window as any).isCloudUpdatingLocal) {
    // Track that a local change happened for this key
    originalSetItem('bt_last_local_write_' + key, Date.now().toString());
  }
  return originalSetItem(key, value);
};

localStorage.removeItem = (key: string) => {
  if (!(window as any).isCloudUpdatingLocal) {
    originalSetItem('bt_last_local_write_' + key, Date.now().toString());
  }
  return originalRemoveItem(key);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BattrickAuthProvider>
      <App />
    </BattrickAuthProvider>
  </StrictMode>,
);
