import type { JSX } from 'preact';
import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';

export interface GuidedCoachProps {
  stepId: string;
  title: string;
  body: string;
  /** A selector for a real control. null is an outcome explanation, without a spotlight. */
  target: string | null;
  onSkip: () => void;
  onNext?: () => void;
  nextLabel?: string;
  progress?: string;
}
interface Box { left: number; top: number; width: number; height: number }
interface Placement { box: Box; ring: Box | null; missing: boolean; ready: boolean }
const empty: Placement = { box: { left: 8, top: 8, width: 288, height: 240 }, ring: null, missing: false, ready: false };
let guideId = 0;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, Math.max(min, max)));
function shown(el: HTMLElement): boolean {
  return !el.closest('[inert], [hidden], [aria-hidden="true"]') && el.getClientRects().length > 0
    && getComputedStyle(el).visibility !== 'hidden';
}
function clipToScrollers(el: HTMLElement, box: Box): Box {
  let left = box.left, top = box.top, right = left + box.width, bottom = top + box.height;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const css = getComputedStyle(p), rect = p.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
    if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
  }
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
/** Scroll real nested reading regions, without scrolling the document or moving focus. */
function reveal(el: HTMLElement): void {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const css = getComputedStyle(p), rect = p.getBoundingClientRect(), target = el.getBoundingClientRect();
    if (/(auto|scroll)/.test(css.overflowY) && p.scrollHeight > p.clientHeight) {
      if (target.top < rect.top) p.scrollTop += target.top - rect.top - 6;
      else if (target.bottom > rect.bottom) p.scrollTop += Math.min(target.bottom - rect.bottom + 6, target.top - rect.top);
    }
    if (/(auto|scroll)/.test(css.overflowX) && p.scrollWidth > p.clientWidth) {
      if (target.left < rect.left) p.scrollLeft += target.left - rect.left - 6;
      else if (target.right > rect.right) p.scrollLeft += target.right - rect.right + 6;
    }
  }
}

/** Presentation only: the owner advances steps after observing real game state. */
export function GuidedCoach({ stepId, title, body, target, onSkip, onNext, nextLabel, progress }: GuidedCoachProps): JSX.Element {
  const anchor = useRef<HTMLSpanElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLElement>(null);
  const id = useRef(`guided-coach-${++guideId}`);
  const revealed = useRef(new Set<string>());
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  useLayoutEffect(() => setCollapsed(false), [stepId, target]);
  const [place, setPlace] = useState<Placement>(empty);

  useLayoutEffect(() => {
    let disposed = false, queued = false;
    let described: HTMLElement | null = null;
    let originalDescription: string | null = null;
    let attachedDescription: string | null = null;
    let observed: HTMLElement | null = null;
    const descriptionId = `${id.current}-description`;
    const detach = () => {
      if (!described) return;
      const current = described.getAttribute('aria-describedby');
      if (current === attachedDescription) {
        if (originalDescription !== null) described.setAttribute('aria-describedby', originalDescription);
        else described.removeAttribute('aria-describedby');
      } else {
        const remaining = (current ?? '').split(/\s+/).filter(x => x && x !== descriptionId);
        if (remaining.length) described.setAttribute('aria-describedby', remaining.join(' '));
        else described.removeAttribute('aria-describedby');
      }
      described = null;
    };
    const resize = new ResizeObserver(() => schedule());
    const measure = () => {
      if (disposed) return;
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('.sheet[role="dialog"]')).filter(shown);
      const activeHost = dialogs.at(-1) ?? anchor.current?.parentElement ?? null;
      if (activeHost !== host) { detach(); setHost(activeHost); return; }
      if (!activeHost || !layer.current || !note.current) return;
      let control: HTMLElement | null = null;
      if (target) {
        try { control = Array.from(activeHost.querySelectorAll<HTMLElement>(target)).find(shown) ?? null; } catch { /* Invalid/stale selectors degrade to an optional note. */ }
      }
      if (control !== described) {
        detach();
        if (control) {
          originalDescription = control.getAttribute('aria-describedby');
          const ids = (originalDescription ?? '').split(/\s+/).filter(Boolean);
          attachedDescription = [...new Set([...ids, descriptionId])].join(' ');
          control.setAttribute('aria-describedby', attachedDescription);
          described = control;
        }
      }
      if (control !== observed) { if (observed) resize.unobserve(observed); if (control) resize.observe(control); observed = control; }
      const key = `${stepId}:${target}`;
      if (control && !revealed.current.has(key)) { revealed.current.add(key); reveal(control); }
      const origin = layer.current.getBoundingClientRect();
      const css = getComputedStyle(layer.current);
      const viewport = window.visualViewport;
      const left = Math.max(origin.left, viewport?.offsetLeft ?? 0) + Math.max(8, parseFloat(css.paddingLeft) || 0);
      const chrome = activeHost.querySelector<HTMLElement>(':scope > .command-bar')?.getBoundingClientRect();
      const navigation = activeHost.querySelector<HTMLElement>(':scope > .command-nav')?.getBoundingClientRect();
      const top = Math.max(Math.max(origin.top, viewport?.offsetTop ?? 0) + Math.max(8, parseFloat(css.paddingTop) || 0), chrome ? chrome.bottom + 8 : 0);
      const right = Math.min(origin.right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth)) - Math.max(8, parseFloat(css.paddingRight) || 0);
      const bottom = Math.min(Math.min(origin.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight)) - Math.max(8, parseFloat(css.paddingBottom) || 0), navigation ? navigation.top - 8 : Infinity);
      const rect = control?.getBoundingClientRect();
      const clipped = control && rect ? clipToScrollers(control, rect) : null;
      const ring = clipped && clipped.width > 0 && clipped.height > 0 ? clipped : null;
      // Keep the action footer free even when the highlighted control is elsewhere.
      const footer = Array.from(activeHost.querySelectorAll<HTMLElement>('footer, .dv4-footer, .workspace-footer, .pilot-inspector__footer, .action-sheet__footer, .report-footer'))
        .filter(shown).map(el => el.getBoundingClientRect()).filter(r => r.top > top + 100 && r.bottom >= bottom - 48).sort((a,b) => a.top-b.top)[0];
      const safeBottom = footer && !control?.closest('footer, .dv4-footer, .workspace-footer, .pilot-inspector__footer, .action-sheet__footer, .report-footer') ? Math.min(bottom, footer.top - 8) : bottom;
      const gap = 12;
      const spaces: Box[] = ring ? [
        { left, top, width: right-left, height: ring.top-gap-top },
        { left, top: ring.top+ring.height+gap, width: right-left, height: safeBottom-ring.top-ring.height-gap },
        { left, top, width: ring.left-gap-left, height: safeBottom-top },
        { left: ring.left+ring.width+gap, top, width: right-ring.left-ring.width-gap, height: safeBottom-top },
      ] : [{ left, top, width: right-left, height: safeBottom-top }];
      const available = spaces.filter(r => r.width >= Math.min(240, right-left) && r.height >= 108);
      // No screen-wide overlay: even a constrained note has its own scrollable copy.
      const area = (available.length ? available : spaces).sort((a,b) => Math.min(340,b.width)*Math.min(210,b.height)-Math.min(340,a.width)*Math.min(210,a.height))[0];
      const width = Math.max(160, Math.min(collapsed ? 280 : 340, area.width));
      const height = Math.max(88, Math.min(collapsed ? 96 : 260, area.height));
      const x = clamp(ring ? ring.left : right-width, area.left, Math.min(right-width, area.left+area.width-width));
      const y = clamp(ring && area.top <= ring.top ? ring.top-height : area.top, area.top, safeBottom-height);
      const next: Placement = { box: { left:x-origin.left, top:y-origin.top, width, height }, ring: ring ? { left:ring.left-origin.left, top:ring.top-origin.top, width:ring.width, height:ring.height } : null, missing: !!target && !control, ready:true };
      setPlace(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    function schedule() { if (queued || disposed) return; queued = true; queueMicrotask(() => { queued = false; measure(); }); }
    const changes = new MutationObserver(records => {
      if (records.some(record => !layer.current?.contains(record.target))) schedule();
    });
    changes.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['inert','hidden','class','aria-hidden'] });
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    document.addEventListener('transitionend', schedule, true);
    document.addEventListener('animationend', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    if (layer.current) resize.observe(layer.current);
    if (note.current) resize.observe(note.current);
    measure();
    return () => {
      disposed = true; detach(); resize.disconnect(); changes.disconnect();
      window.removeEventListener('resize', schedule); document.removeEventListener('scroll', schedule, true);
      document.removeEventListener('transitionend', schedule, true); document.removeEventListener('animationend', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [host, stepId, target, title, body, progress, !!onNext, collapsed]);

  return <><span ref={anchor} hidden data-guide-anchor />{host && createPortal(
    <div ref={layer} class="guided-coach" data-guide-step={stepId} style={{ visibility: place.ready ? 'visible' : 'hidden' }}>
      {place.ring && <div class="guided-coach__ring" aria-hidden="true" style={{ ...place.ring }} />}
      <aside ref={note} class={`guided-coach__note${collapsed ? " guided-coach__note--collapsed" : ""}`} style={{ left:place.box.left, top:place.box.top, width:place.box.width, maxHeight:place.box.height }} aria-label={title} data-guide-note>
        <div class="guided-coach__copy" hidden={collapsed} aria-live="polite" aria-atomic="true" id={`${id.current}-description`}>
          {progress && <span class="guided-coach__progress">{progress}</span>}
          <h2>{title}</h2><p>{body}</p>
          {place.missing && <p class="guided-coach__missing">{t('This control is not on this screen. You can keep playing or skip the guide.')}</p>}
        </div>
        <div class="guided-coach__actions">
          {!onNext && <button type="button" onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed} aria-controls={`${id.current}-description`} data-guide-toggle>{collapsed ? t('Show hint') : t('Hide hint')}</button>}
          <button type="button" onClick={onSkip} data-guide-skip>{t('Skip guide')}</button>
          {onNext && !collapsed && <button type="button" class="guided-coach__next" onClick={onNext} data-guide-next>{nextLabel ?? t('Continue')}</button>}
        </div>
      </aside>
    </div>, host) as JSX.Element}</>;
}
