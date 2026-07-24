import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Wraps the Next.js web build for iOS/Android via Capacitor.
 *
 * Capacitor serves a static export, so the mobile build uses
 * a static export (BUILD_EXPORT=true) rather than the default
 * server-rendered config used for the Vercel deployment. See
 * docs/DEPLOYMENT.md § Mobile (Capacitor) for the full build steps:
 *
 *   BUILD_EXPORT=true npm run build   (produces ./out)
 *   npx cap sync
 *   npx cap open ios | android
 */
const config: CapacitorConfig = {
  appId: 'app.orbit.mobile',
  appName: 'Orbit',
  webDir: 'out',
  backgroundColor: '#06070a',
  server: {
    // During development, point the shell at the live Next.js dev server
    // instead of a bundled static build so you get hot reload on-device.
    // url: 'http://192.168.1.10:3000',
    // cleartext: true,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#06070a',
  },
  android: {
    backgroundColor: '#06070a',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#06070a',
      showSpinner: false,
    },
  },
};

export default config;
