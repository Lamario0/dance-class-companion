// Android back button (spec slice 5): close an open sheet or the left menu;
// otherwise exit the app. Only active inside the Capacitor app.
import { useEffect } from 'react';
import { isNativeApp } from '../../services/platform';

const somethingOpen = () =>
  document.documentElement.classList.contains('sheet-open') || !!document.getElementById('side-menu');

export const useAndroidBackButton = () => {
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    import('@capacitor/app').then(({ App }) =>
      App.addListener('backButton', () => {
        if (somethingOpen()) {
          // Sheets and the menu already close on Escape.
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        } else {
          App.exitApp();
        }
      }).then(handle => {
        if (cancelled) handle.remove();
        else remove = () => handle.remove();
      }),
    );
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
};
