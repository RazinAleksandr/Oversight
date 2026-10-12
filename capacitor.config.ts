import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.viktor.oversight',
  appName: 'Oversight',
  webDir: 'dist',
  ios: { contentInset: 'never', backgroundColor: '#070b14', preferredContentMode: 'mobile' },
};
export default config;
