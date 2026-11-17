// Android back button (spec slice 5), in order:
// 1. leave a fullscreen video, 2. close the top open sheet, 3. close the left
// menu, 4. otherwise leave the app. "Leave" moves it to the background (Android
// 12+'s own default) rather than killing it, so nothing in progress (an unsaved
// note) is lost. Only active inside the Capacitor app.
import { useEffect } from 'react';
import { isNativeApp } from '../../services/platform';
import { closeTopSheet } from '../ui/BottomSheet';

export const useAndroidBackButton = (menuOpen: boolean, closeMenu: () => void) => {
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    import('@capacitor/app').then(({ App }) =>
      App.addListener('backButton', () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else if (closeTopSheet()) {
          /* closed the top sheet */
        } else if (latest.menuOpen) {
          latest.closeMenu();
        } else {
          App.minimizeApp();
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
  latest.menuOpen = menuOpen;
  latest.closeMenu = closeMenu;
};

// Latest menu state for the long-lived listener above.
const latest = { menuOpen: false, closeMenu: () => {} };
