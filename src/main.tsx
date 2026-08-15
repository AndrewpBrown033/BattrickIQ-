import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept localStorage writes/removes to track local modifications and avoid race conditions with incoming Firestore snapshots
const originalSetItem = localStorage.setItem;
localStorage.setItem = function (key: string, value: string) {
  if (
    key.startsWith('bt_') && 
    !key.startsWith('bt_last_local_write_') && 
    !key.startsWith('bt_custom_user') && 
    !(window as any).isCloudUpdatingLocal
  ) {
    originalSetItem.call(localStorage, 'bt_last_local_write_' + key, Date.now().toString());
  }
  originalSetItem.call(localStorage, key, value);
};

const originalRemoveItem = localStorage.removeItem;
localStorage.removeItem = function (key: string) {
  if (
    key.startsWith('bt_') && 
    !key.startsWith('bt_last_local_write_') && 
    !key.startsWith('bt_custom_user') && 
    !(window as any).isCloudUpdatingLocal
  ) {
    originalSetItem.call(localStorage, 'bt_last_local_write_' + key, Date.now().toString());
  }
  originalRemoveItem.call(localStorage, key);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

