import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jornada360.app',
  appName: 'Jornada360',
  webDir: 'dist',
  server: {
    url: 'https://jornada360.vercel.app',
    cleartext: true
  }
};

export default config;
