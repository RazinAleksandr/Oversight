/**
 * Settings sheet (sound, music, volume, reduced motion, text speed) + in-game menu actions.
 */
import type { JSX } from 'preact';
import type { ComponentChildren } from 'preact';
import { Seg } from '../components/Common';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { useSettings } from '../settings';
import { cx } from '../util';

/** A whole settings row that toggles (≥ 44px hit target), rendered as one switch control. */
function SwitchRow({ on, onChange, name, desc, icon }: { on: boolean; onChange(v: boolean): void; name: string; desc?: string; icon?: string }): JSX.Element {
  return (
    <button type="button" role="switch" aria-checked={on} class="setting setting--switch" onClick={() => onChange(!on)}>
      <span class="setting__text">
        <span class="setting__name">
          {icon && <Icon name={icon} size={16} />} {name}
        </span>
        {desc && <span class="setting__desc">{desc}</span>}
      </span>
      <span class={cx('switch', on && 'is-on')} aria-hidden="true">
        <span class="switch__knob" />
        <span class="switch__text">{on ? 'On' : 'Off'}</span>
      </span>
    </button>
  );
}

function QuitPrompt({ onStay, onQuit }: { onStay(): void; onQuit?(): void }): JSX.Element {
  return (
    <div class="quitprompt" role="alertdialog" aria-label="Return to title?">
      <p class="quitprompt__title">Return to the title screen?</p>
      <p class="quitprompt__text">Your run is saved — you can pick it up again with Continue.</p>
      <div class="quitprompt__actions">
        <button type="button" class="btn btn--primary" onClick={onStay} data-autofocus>
          Keep playing
        </button>
        <button type="button" class="btn btn--danger" onClick={onQuit}>
          Return to title
        </button>
      </div>
    </div>
  );
}

export function SettingsSheet({
  onClose,
  inGame,
  onHowTo,
  onQuit,
  confirmQuit,
}: {
  onClose(): void;
  inGame?: boolean;
  onHowTo?(): void;
  onQuit?(): void;
  confirmQuit?: boolean;
}): JSX.Element {
  const { settings, update } = useSettings();
  return (
    <Sheet label={inGame ? 'Menu' : 'Settings'} onClose={onClose} class="settings-sheet">
      <header class="detail__head">
        <span class="detail__icon is-accent">
          <Icon name="settings" size={24} />
        </span>
        <div class="detail__title">
          <p class="eyebrow">{inGame ? 'Paused' : 'Options'}</p>
          <h2>{inGame ? 'Menu' : 'Settings'}</h2>
        </div>
      </header>

      {confirmQuit && <QuitPrompt onStay={onClose} onQuit={onQuit} />}

      <div class="settings">
        <SwitchRow on={settings.sound} onChange={(v) => update({ sound: v })} name="Sound effects" icon="sound" />
        <SwitchRow on={settings.music} onChange={(v) => update({ music: v })} name="Music" icon="music" desc="Ambient score that tightens as the clock nears midnight." />
        <div class="setting setting--col">
          <label class="setting__name" for="set-volume">
            Volume <span class="num dim">{Math.round(settings.volume * 100)}%</span>
          </label>
          <input
            id="set-volume"
            class="range-input"
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(settings.volume * 100)}
            onInput={(e) => update({ volume: Number((e.target as HTMLInputElement).value) / 100 })}
            style={{ '--pct': `${settings.volume * 100}%` }}
          />
        </div>
        <SwitchRow
          on={settings.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
          name="Reduced motion"
          desc="No shake, glitch, particles or typewriter; shorter animations."
        />
        <div class="setting setting--col">
          <span class="setting__name">Briefing text speed</span>
          <Seg
            label="Text speed"
            value={settings.textSpeed}
            onChange={(v) => update({ textSpeed: v })}
            options={[
              { id: 'instant', label: 'Instant' },
              { id: 'fast', label: 'Fast' },
              { id: 'normal', label: 'Typewriter' },
            ]}
          />
        </div>
      </div>

      {inGame && (
        <div class="settings__game">
          <button type="button" class="btn" onClick={onHowTo}>
            <Icon name="help" size={17} /> How to Play
          </button>
          <button type="button" class="btn btn--danger" onClick={onQuit}>
            <Icon name="back" size={17} /> Save &amp; quit to title
          </button>
        </div>
      )}
      <div class="sheet__actions">
        <button type="button" class="btn btn--primary btn--wide" onClick={onClose} data-autofocus={confirmQuit ? undefined : ''}>
          {inGame ? 'Resume' : 'Done'}
        </button>
      </div>
    </Sheet>
  );
}
