import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.danceclasscompanion.app',
  appName: 'Dance Class Companion',
  webDir: 'dist',
  plugins: {
    // Native Google account picker; the returned credential signs into the web
    // Firebase SDK (services/authService.ts), so the rest of the app is unchanged.
    // Slice 6: no system alert while the app is open; the app shows a toast
    // instead (and nothing while the chat is on screen).
    FirebaseMessaging: {
      presentationOptions: [],
    },
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
