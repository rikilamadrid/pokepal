import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config — wraps the Next.js static export (`out/`) as native
 * iPhone/iPad + Android apps. Build pipeline: `npm run build` → `npx cap sync`
 * → open in Xcode / Android Studio. See NATIVE.md.
 */
const config: CapacitorConfig = {
  appId: "com.pokepal.app",
  appName: "PokéPal",
  // Next.js `output: 'export'` writes the static bundle here (phase 1).
  webDir: "out",
  backgroundColor: "#14151a",
  ios: {
    // Match the dark app canvas so there's no white flash on launch.
    backgroundColor: "#14151a",
    contentInset: "always",
  },
  android: {
    backgroundColor: "#14151a",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#14151a",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
