// Android app links and the in-app scanner (slice 4). Class QR codes encode
// https://danceclasscompanion.com/checkin/<slotId>; in the app, opening such a
// link (from the camera, a message, the scanner) goes to that check-in.
// Everything native is imported on use, so the website's bundle doesn't grow.
import { useEffect, useRef } from 'react';
import { isNativeApp } from './platform';

/** The slot id in a class check-in link, or null if it isn't one. */
export const slotFromLink = (text: string): string | null => {
  try {
    const u = new URL(text.trim());
    if (u.protocol !== 'https:' || (u.hostname !== 'danceclasscompanion.com' && u.hostname !== 'www.danceclasscompanion.com')) return null;
    const m = /^\/checkin\/([A-Za-z0-9_-]{1,64})\/?$/.exec(u.pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
};

/** Calls `onSlot` when the app is opened (cold or warm) by a class check-in link. */
export const useAppLinks = (onSlot: (slotId: string) => void) => {
  const latest = useRef(onSlot);
  latest.current = onSlot;
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    import('@capacitor/app').then(async ({ App }) => {
      const launch = await App.getLaunchUrl().catch(() => undefined);
      const first = launch?.url ? slotFromLink(launch.url) : null;
      if (first && !cancelled) latest.current(first);
      const handle = await App.addListener('appUrlOpen', e => {
        const slot = slotFromLink(e.url);
        if (slot) latest.current(slot);
      });
      if (cancelled) handle.remove();
      else remove = () => handle.remove();
    });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
};

export type ScanResult = { kind: 'slot'; slotId: string } | { kind: 'other' } | { kind: 'cancelled' };

/**
 * Google's code scanner (via Play services): no camera permission for the app.
 * Installs the scanner module on first use if the phone doesn't have it yet.
 */
export const scanClassCode = async (): Promise<ScanResult> => {
  const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule();
  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    const text = barcodes[0]?.rawValue ?? '';
    if (!text) return { kind: 'cancelled' };
    const slotId = slotFromLink(text);
    return slotId ? { kind: 'slot', slotId } : { kind: 'other' };
  } catch (err: any) {
    if (/cancel/i.test(String(err?.message ?? err))) return { kind: 'cancelled' };
    throw err;
  }
};
