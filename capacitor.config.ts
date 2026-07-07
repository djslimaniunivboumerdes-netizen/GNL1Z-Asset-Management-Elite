import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sonatrach.gnl1z",
  appName: "GNL1Z-MANAGER",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // Allow cleartext for Supabase calls during development.
    // Remove in production once you've pinned your TLS.
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
