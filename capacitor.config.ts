import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medirecord.app',
  appName: 'MediRecord',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;