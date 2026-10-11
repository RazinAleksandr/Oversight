/**
 * Number that tweens between values via fx.tweenNumber. The span's text is owned imperatively
 * (no Preact children) so the tween and the virtual DOM never fight over the same text node.
 */
import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { fx } from '../../fx';

const round = (n: number) => String(Math.round(n));

export function TweenNum({
  value,
  format = round,
  ms = 450,
  class: cls,
  tween = true,
}: {
  value: number;
  format?: (n: number) => string;
  ms?: number;
  class?: string;
  tween?: boolean;
}): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (from === null || from === value || !tween) {
      el.textContent = format(value);
      return;
    }
    try {
      fx.tweenNumber(el, from, value, ms, format);
    } catch {
      el.textContent = format(value);
    }
  }, [value]);
  return <span ref={ref} class={cls} />;
}
