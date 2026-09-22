import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.slayer.webpreview",
  appName: "SLAYER Web Preview",
  webDir: "dist",
  server: { cleartext: false },
};

export default config;
