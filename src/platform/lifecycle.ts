import { App } from '@capacitor/app';
import { native, flushStorage } from './storage';
import { setAudioActive } from '../audio';
import { fx } from '../fx';
export async function installLifecycle(): Promise<() => void> {
  if (!native) return () => {};
  const listener = await App.addListener('appStateChange', ({ isActive }) => {
    setAudioActive(isActive);
    if (!isActive) {
      fx.stopBackground();
      void flushStorage().catch(e => console.error('[background save]', e));
    } else {
      const canvas = document.getElementById('bg-canvas');
      if (canvas instanceof HTMLCanvasElement) fx.startBackground(canvas);
    }
  });
  return () => { void listener.remove(); };
}
