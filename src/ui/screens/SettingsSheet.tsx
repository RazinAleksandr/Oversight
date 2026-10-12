/**
 * Settings sheet (sound, music, volume, reduced motion, text speed, language) + in-game menu actions.
 */
import type { JSX } from 'preact';
import { LANGS, type Lang, getLang, t } from '../../i18n';
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
        <span class="switch__text">{on ? t('On') : t('Off')}</span>
      </span>
    </button>
  );
}

function QuitPrompt({ onStay, onQuit }: { onStay(): void; onQuit?(): void }): JSX.Element {
  return (
    <div class="quitprompt" role="alertdialog" aria-label={t('Return to title?')}>
      <p class="quitprompt__title">{t('Return to the title screen?')}</p>
      <p class="quitprompt__text">{t('Your run is saved — you can pick it up again with Continue.')}</p>
      <div class="quitprompt__actions">
        <button type="button" class="btn btn--primary" onClick={onStay} data-autofocus>
          {t('Keep playing')}
        </button>
        <button type="button" class="btn btn--danger" onClick={onQuit}>
          {t('Return to title')}
        </button>
      </div>
    </div>
  );
}

export function SettingsSheet({
  onClose,
  inGame,
  hasSave,
  onHowTo,
  onQuit,
  onLang,
  confirmQuit,
  onExport,
  onImport,
}: {
  onClose(): void;
  inGame?: boolean;
  /** A saved run exists (switching language mid-run deserves a note). */
  hasSave?: boolean;
  onHowTo?(): void;
  onQuit?(): void;
  /** Saves (if needed) and switches language — reloads the page. */
  onLang(l: Lang): void;
  confirmQuit?: boolean;
  onExport?(): void;
  onImport?(file: File): void;
}): JSX.Element {
  const { settings, update } = useSettings();
  const lang = getLang();
  return (
    <Sheet label={inGame ? t('Menu') : t('Settings')} onClose={onClose} class="settings-sheet">
      <header class="detail__head">
        <span class="detail__icon is-accent">
          <Icon name="settings" size={24} />
        </span>
        <div class="detail__title">
          <p class="eyebrow">{inGame ? t('Paused') : t('Options')}</p>
          <h2>{inGame ? t('Menu') : t('Settings')}</h2>
        </div>
      </header>

      {confirmQuit && <QuitPrompt onStay={onClose} onQuit={onQuit} />}

      <div class="settings">
        <SwitchRow on={settings.sound} onChange={(v) => update({ sound: v })} name={t('Sound effects')} icon="sound" />
        <SwitchRow on={settings.music} onChange={(v) => update({ music: v })} name={t('Music')} icon="music" desc={t('Ambient score that tightens as the clock nears midnight.')} />
        <div class="setting setting--col">
          <label class="setting__name" for="set-volume">
            {t('Volume')} <span class="num dim">{Math.round(settings.volume * 100)}%</span>
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
          name={t('Reduced motion')}
          desc={t('No shake, glitch, particles or typewriter; shorter animations.')}
        />
        <div class="setting setting--col">
          <span class="setting__name">{t('Briefing text speed')}</span>
          <Seg
            label={t('Text speed')}
            value={settings.textSpeed}
            onChange={(v) => update({ textSpeed: v })}
            options={[
              { id: 'instant', label: t('Instant') },
              { id: 'fast', label: t('Fast') },
              { id: 'normal', label: t('Typewriter') },
            ]}
          />
        </div>
        <div class="setting setting--col setting--lang">
          <span class="setting__name">
            <Icon name="world" size={16} /> {t('Language')}
          </span>
          <Seg label={t('Language')} value={lang} onChange={(v) => v !== lang && onLang(v)} options={LANGS.map((l) => ({ id: l.id, label: l.name }))} />
          <span class="setting__desc">
            {inGame || hasSave
              ? t('The page reloads and your run continues. Text already on your desk stays in the previous language until new text arrives.')
              : t('The page reloads in the chosen language.')}
          </span>
        </div>
      </div>

      {inGame && (
        <div class="settings__game">
          <button type="button" class="btn" onClick={onHowTo}>
            <Icon name="help" size={17} /> {t('How to Play')}
          </button>
          <button type="button" class="btn btn--danger" onClick={onQuit}>
            <Icon name="back" size={17} /> {t('Save & quit to title')}
          </button>
        </div>
      )}
      <div class="save-transfer">
        {onExport && <button type="button" class="btn" onClick={onExport}>{t('Export save')}</button>}
        {onImport && <label class="save-import">
          <span>{t('Import save')}</span>
          <input type="file" accept=".json,application/json" onChange={e => {
            const file = e.currentTarget.files?.[0]; if (file) onImport(file);
            e.currentTarget.value = '';
          }} />
        </label>}
      </div>
      <div class="sheet__actions">
        <button type="button" class="btn btn--primary btn--wide" onClick={onClose} data-autofocus={confirmQuit ? undefined : ''}>
          {inGame ? t('Resume') : t('Done')}
        </button>
      </div>
    </Sheet>
  );
}
