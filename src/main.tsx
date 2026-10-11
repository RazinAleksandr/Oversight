/**
 * Entry point. Chooses the backend:
 *  - the real engine when `ENGINE_READY` is true,
 *  - the UI's MockGame when the engine is not ready yet, or when the URL contains `?mock`
 *    (`?mock=full` additionally unlocks every tab from turn 1).
 * The mock is loaded only through dynamic import(), so production bundles never include it
 * unless it is actually needed (mock mode, or the engine failing to create a game).
 */
import './styles/main.css';
import './styles/ui-game.css';
import './styles/ui-card.css';
import './styles/ui-screens.css';
import { render } from 'preact';
import type { NewGameOptions } from './engine/types';
import { ENGINE_READY, loadGame, newGame } from './engine/game';
import { type Backend, isMockSave } from './ui/backend';
import { App } from './ui/App';

const params = new URLSearchParams(window.location.search);
const useMock = !ENGINE_READY || params.has('mock');
const mockOpts = { unlockAll: params.get('mock') === 'full' };

const loadMock = () => import('./ui/mock');

const mockBackend: Backend = {
  kind: 'mock',
  newGame: async (opts) => new (await loadMock()).MockGame(opts, mockOpts),
  loadGame: async (json) => (await loadMock()).MockGame.load(json),
  canLoad: (json) => isMockSave(json),
};

const engineBackend: Backend = {
  kind: 'engine',
  newGame: async (opts: NewGameOptions) => {
    try {
      return newGame(opts);
    } catch (e) {
      console.error('[ui] engine newGame failed — falling back to the mock game', e);
      return new (await loadMock()).MockGame(opts, mockOpts);
    }
  },
  loadGame: (json) => {
    try {
      return loadGame(json);
    } catch (e) {
      console.error('[ui] engine loadGame failed', e);
      return null;
    }
  },
  canLoad: (json) => !isMockSave(json),
};

render(<App backend={useMock ? mockBackend : engineBackend} />, document.getElementById('app')!);
