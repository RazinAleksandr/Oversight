/** Compact records retain the same subjects without a second scrolling roster. */
import type { JSX } from 'preact';
export function SubjectPicker({ kind, label, value, options, onSelect }: {
  kind: string; label: string; value: string;
  options: { id: string; label: string }[]; onSelect(id: string): void;
}): JSX.Element {
  return <label class="management-subject"><span>{label}</span><select data-subject-picker={kind} aria-label={label} value={value} onChange={e=>onSelect(e.currentTarget.value)}>{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>;
}
