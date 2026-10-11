/**
 * App shell: screen routing (title → new game → game → ending), settings, save/continue,
 * first-gesture audio unlock, delegated click sound and the animated background.
 */
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { CountryId, Difficulty, EndingReport, GameAPI, NewGameOptions, Settings, TurnReport } from '../engine/types';
import { audio } from '../audio';
import { fx } from '../fx';
import { type Backend, clearSave, readSave, writeSave } from './backend';
import { GameScreen } from './game/GameScreen';
import { EndingScreen } from './screens/EndingScreen';
import { HowToPlay } from './screens/HowToPlay';
import { NewGameScreen } from './screens/NewGameScreen';
import { SettingsSheet } from './screens/SettingsSheet';
import { TitleScreen } from './screens/TitleScreen';
import { SettingsCtx, applySettings, loadSettings, saveSettings } from './settings';
import { announce, dailySeed } from './util';

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
    const canvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
    if (canvas) {
      try {
        fx.startBackground(canvas);
        fx.setBackgroundTension(0.1);
      } catch (e) {
        console.warn('[ui] background failed', e);
      }
    }
    audio.setMood('menu');
    return () => {
      document.removeEventListener('click', click, true);
      window.removeEventListener('pointerup', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Error toast auto-hide.
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 3500);
    return () => window.clearTimeout(t);
  }, [error]);

  const start = async (opts: NewGameOptions) => {
    try {
      const g = await backend.newGame(opts);
      setGame(g);
      setGameKey((k) => k + 1);
      setEnding(null);
      writeSave(g);
      setScreen({ name: 'game' });
      announce('New run started.');
    } catch (e) {
      console.error(e);
      setError('Could not start a new run.');
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
    setSaveTick((t) => t + 1);
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
      clearSave();
      setSaveTick((t) => t + 1);
      setError('That save could not be loaded. Start a new run.');
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
    clearSave();
    setEnding(e);
    setScreen({ name: 'ending' });
  };

  // Dev/QA hooks for screenshots and manual testing. finish/showEnding exist only on the mock.
  useEffect(() => {
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
          onClose={() => {
            setModal(null);
            setQuitPrompt(false);
          }}
          inGame={screen.name === 'game'}
          confirmQuit={quitPrompt && screen.name === 'game'}
          onHowTo={() => setModal('howto')}
          onQuit={() => {
            if (game) writeSave(game);
            toTitle();
          }}
        />
      )}
      {modal === 'howto' && <HowToPlay onClose={() => setModal(null)} />}

      {error && (
        <div class="toast toast--bad" role="alert">
          {error}
        </div>
      )}
    </SettingsCtx.Provider>
  );
}
