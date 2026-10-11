import { useEffect, useRef, useState } from 'preact/hooks';

/** Reactive media query. */
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export const DESKTOP_QUERY = '(min-width: 1100px)';

/** Keeps a CSS custom property in sync with an element's height (e.g. --hud-h for sheets below the HUD). */
export function useHeightVar<T extends HTMLElement>(varName: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty(varName, `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(varName);
    };
  }, [varName]);
  return ref;
}

/** Previous value of a variable (from the last render). */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
