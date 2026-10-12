/**
 * App shell: screen routing (title → new game → game → ending), settings, save/continue,
 * first-gesture audio unlock, delegated click sound and the animated background.
 */
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { CountryId, Difficulty, EndingReport, GameAPI, NewGameOptions, Settings, TurnReport } from '../engine/types';
import { audio } from '../audio';
import { fx } from '../fx';
import { t } from '../i18n';
import { type Backend, readSave, writeSave } from './backend';
import { GameScreen } from './game/GameScreen';
import { EndingScreen } from './screens/EndingScreen';
import { HowToPlay } from './screens/HowToPlay';
import { NewGameScreen } from './screens/NewGameScreen';
import { SettingsSheet } from './screens/SettingsSheet';
import { TitleScreen } from './screens/TitleScreen';
import { switchLang } from './lang';
import { SettingsCtx, applySettings, loadSettings, saveSettings } from './settings';
import { installLifecycle } from '../platform/lifecycle';
import { announce, dailySeed } from './util';
import { flushStorage, readSnapshot, retrySave, saveStatus, watchStorage } from '../platform/storage';
import { exportSave } from '../platform/transfer';
import { Sheet } from './components/Sheet';

type Screen = { name: 'title' } | { name: 'newgame'; daily: boolean } | { name: 'game'; report?: TurnReport | null } | { name: 'ending' };

declare global {
  interface Window {
    __ato?: Record<string, unknown>;
  }
}

export function App({ backend }: { backend: Backend }): JSX.Element {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'title' });
  const [game, setGame] = useState<GameAPI | null>(null);
  const [ending, setEnding] = useState<EndingReport | null>(null);
  const [modal, setModal] = useState<null | 'settings' | 'howto'>(null);
  const [quitPrompt, setQuitPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [importedGame, setImportedGame] = useState<GameAPI | null>(null);
  const [storageStatus, setStorageStatus] = useState(saveStatus);
  useEffect(() => watchStorage(() => {
    const status = saveStatus(); setStorageStatus(status);
    if (status === 'saved') setError(null);
  }), []);

  const hasSave = useMemo(() => {
    const j = readSave();
    return !!j && backend.canLoad(j);
  }, [screen.name, saveTick]);

  // Settings → audio/fx/document, persisted.
  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  // One-time global wiring.
  useEffect(() => {
    const unlock = () => {
      audio.unlock();
      window.removeEventListener('pointerup', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerup', unlock);
    window.addEventListener('keydown', unlock);
    const click = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.('button');
      if (b && !b.hasAttribute('data-nosfx') && !(b as HTMLButtonElement).disabled) audio.play('click');
    };
    document.addEventListener('click', click, true);
    audio.setMood('menu');
    return () => {
      document.removeEventListener('click', click, true);
      window.removeEventListener('pointerup', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const cleanup = installLifecycle().catch(e => { console.error('[lifecycle]', e); return () => {}; });
    return () => { void cleanup.then(fn => fn()); };
  }, []);


  const start = async (opts: NewGameOptions) => {
    try {
      const g = await backend.newGame(opts);
      setGame(g);
      setGameKey((k) => k + 1);
      setEnding(null);
      writeSave(g, null);
      setScreen({ name: 'game' });
      announce(t('New run started.'));
    } catch (e) {
      console.error(e);
      setError(t('Could not start a new run.'));
    }
  };

  const toTitle = () => {
    setModal(null);
    setQuitPrompt(false);
    audio.setMood('menu');
    try {
      fx.setBackgroundTension(0.1);
    } catch {
      /* optional */
    }
    setScreen({ name: 'title' });
    setSaveTick((n) => n + 1);
  };

  const continueGame = async () => {
    const json = readSave();
    let g: GameAPI | null = null;
    try {
      g = json ? await backend.loadGame(json) : null;
    } catch (e) {
      console.error(e);
    }
    if (!g) {
      setSaveTick((n) => n + 1);
      setError(t('That save could not be loaded. The original has been kept.'));
      return;
    }
    const v = g.view();
    setGame(g);
    setGameKey((k) => k + 1);
    if (v.gameOver && v.ending) {
      setEnding(v.ending);
      setScreen({ name: 'ending' });
      return;
    }
    setScreen({ name: 'game', report: null });
  };

  const onEnding = (e: EndingReport) => {
    if (game) writeSave(game);
    setEnding(e);
    setScreen({ name: 'ending' });
  };

  // Dev/QA hooks for screenshots and manual testing. finish/showEnding exist only on the mock.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const devFinish = (game as unknown as { devFinish?(t: string): void } | null)?.devFinish;
    window.__ato = {
      backend: backend.kind,
      game,
      settings: () => setModal('settings'),
      howto: () => setModal('howto'),
      ...(devFinish
        ? {
            finish: (tone: 'good' | 'bad' = 'good') => devFinish.call(game, tone),
            showEnding: () => {
              const v = game?.view();
              if (v?.ending) onEnding(v.ending);
            },
          }
        : { finish: () => {}, showEnding: () => {} }),
    };
  }, [game]);

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <SettingsCtx.Provider value={{ settings, update }}>
      {screen.name === 'title' && (
        <TitleScreen
          onDebrief={readSnapshot().completed ? async () => {
            const json = readSnapshot().completed;
            try {
              const completed = json ? await backend.loadGame(json) : null;
              const report = completed?.view().ending;
              if (report) { setEnding(report); setScreen({ name: 'ending' }); }
              else setError(t('That save could not be loaded. The original has been kept.'));
            } catch { setError(t('That save could not be loaded. The original has been kept.')); }
          } : undefined}
          hasSave={hasSave}
          mock={backend.kind === 'mock'}
          onContinue={continueGame}
          onNew={() => setScreen({ name: 'newgame', daily: false })}
          onDaily={() => setScreen({ name: 'newgame', daily: true })}
          onHowTo={() => setModal('howto')}
          onSettings={() => setModal('settings')}
        />
      )}
      {screen.name === 'newgame' && (
        <NewGameScreen
          daily={screen.daily}
          onBack={() => setScreen({ name: 'title' })}
          onStart={(countryId: CountryId, difficulty: Difficulty) => start(screen.daily ? { countryId, difficulty, seed: dailySeed(), dailySeed: true } : { countryId, difficulty })}
        />
      )}
      {screen.name === 'game' && game && (
        <GameScreen
          key={gameKey}
          game={game}
          onEnding={onEnding}
          onMenu={(o) => {
            setQuitPrompt(!!o?.confirmQuit);
            setModal('settings');
          }}
          initialReport={screen.report}
        />
      )}
      {screen.name === 'ending' && ending && (
        <EndingScreen
          ending={ending}
          onReplay={() => start({ countryId: ending.countryId, difficulty: ending.difficulty, seed: ending.seed })}
          onNew={() => setScreen({ name: 'newgame', daily: false })}
          onTitle={toTitle}
        />
      )}

      {modal === 'settings' && (
        <SettingsSheet
          onExport={readSnapshot().active || readSnapshot().completed ? () => {
            const json = readSnapshot().active ?? readSnapshot().completed;
            if (json) void exportSave(json).catch(() => setError(t('Save export could not be completed.')));
          } : undefined}
          onImport={async file => {
            try {
              if (file.size > 8 * 1024 * 1024) throw new Error('File too large');
              const json = await file.text();
              const candidate = await backend.loadGame(json);
              if (!candidate) throw new Error('Invalid save');
              candidate.view(); candidate.getActions();
              setImportedGame(candidate);
            } catch { setError(t('This file is not a supported Oversight save. Your current run was kept.')); }
          }}
          onClose={() => {
            setModal(null);
            setQuitPrompt(false);
          }}
          inGame={screen.name === 'game'}
          hasSave={hasSave}
          confirmQuit={quitPrompt && screen.name === 'game'}
          onHowTo={() => setModal('howto')}
          onQuit={async () => {
            if (game) writeSave(game);
            try { await flushStorage(); toTitle(); }
            catch { setError(t('Save failed. Retry before leaving the game.')); }
          }}
          onLang={async (l) => {
            if (game && screen.name === 'game') writeSave(game);
            try { await flushStorage(); await switchLang(l); }
            catch { setError(t('Save failed. Retry before leaving the game.')); }
          }}
        />
      )}
      {modal === 'howto' && <HowToPlay view={screen.name === 'game' ? game?.view() : undefined} onClose={() => setModal(null)} />}
      {importedGame && <Sheet label={t('Import save')} onClose={() => setImportedGame(null)} size="overlay">
        <div class="save-error">
          <h2>{t('Replace the current run?')}</h2>
          <p>{importedGame.view().country.name} · {importedGame.view().dateLabel}</p>
          <p>{t('The imported run will replace your active save. Export your current run first if you want to keep it.')}</p>
          <button type="button" class="btn btn--primary" onClick={async () => {
            try {
              writeSave(importedGame, null); await flushStorage();
              setImportedGame(null); setModal(null); setSaveTick(n => n + 1);
              setGame(importedGame); setGameKey(n => n + 1);
              const v = importedGame.view();
              if (v.gameOver && v.ending) { setEnding(v.ending); setScreen({ name: 'ending' }); }
              else setScreen({ name: 'game' });
            } catch { setError(t('Save failed. Retry before leaving the game.')); }
          }}>{t('Import this run')}</button>
          <button type="button" class="btn" onClick={() => setImportedGame(null)}>{t('Cancel')}</button>
        </div>
      </Sheet>}

      {error && storageStatus !== 'failed' && <Sheet label={t('Notice')} size="overlay" onClose={() => setError(null)}>
        <div class="save-error" role="alert">
          <p>{error}</p>
          <button type="button" class="btn btn--primary" onClick={() => setError(null)}>{t('Done')}</button>
        </div>
      </Sheet>}
      {storageStatus === 'failed' && <Sheet label={t('Save failed')} size="overlay"><div class="save-error" role="alert">
        <p>{t('Save failed. Your current run is still open. Retry before leaving.')}</p>
        <button type="button" class="btn btn--small" onClick={retrySave}>{t('Retry save')}</button>
        <button type="button" class="btn" onClick={() => {
          const json = readSnapshot().active ?? readSnapshot().completed;
          if (json) void exportSave(json).catch(() => setError(t('Save export could not be completed.')));
        }}>{t('Export save')}</button>
      </div></Sheet>}
    </SettingsCtx.Provider>
  );
}
