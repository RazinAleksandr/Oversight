import { describe, expect, it } from 'vitest';
import { newGame } from '../src/engine/game';
import { newTask, validateTask } from '../src/ui/game/taskDraft';

function fixture() {
  const game = newGame({ countryId: 'commonwealth', difficulty: 'director', seed: 20261012 });
  const card = game.view().inbox.find(c => c.kind === 'deployment')!;
  return { game, card, draft: newTask(game.view(), card.uid) };
}
describe('deployment task recovery', () => {
  it('recovers a non-deployment decision after a management detour and rejects a locked route', () => {
    const game = newGame({countryId:'commonwealth',difficulty:'director',seed:20261012});
    const card = game.view().inbox.find(c=>c.kind==='intro')!;
    const draft = {...newTask(game.view(),card.uid),selectedId:card.choices[0].id,route:'management',management:{tab:'inbox',section:'briefings'}};
    const before = game.serialize();
    const restored = validateTask(JSON.parse(JSON.stringify(draft)),game.view());
    expect(restored?.selectedId).toBe(card.choices[0].id);
    expect(restored?.route).toBe('management');
    expect(restored?.management?.tab).toBe('inbox');
    expect(game.serialize()).toBe(before);
    expect(validateTask({...draft,management:{tab:'not-a-tab'}},game.view())?.route).toBe('decision');
    expect(validateTask({...draft,route:'company'},game.view())?.route).toBe('decision');
  });
  it('rejects a draft from a different run, quarter or resolved card', () => {
    const { game, card, draft } = fixture();
    expect(validateTask({ ...draft, seed: draft.seed + 1 }, game.view())).toBeNull();
    expect(validateTask({ ...draft, turn: draft.turn + 1 }, game.view())).toBeNull();
    expect(game.resolveChoice(card.uid, 'reject').ok).toBe(true);
    expect(validateTask(draft, game.view())).toBeNull();
  });
  it('keeps the tentative choice after a real investigation without replaying it', () => {
    const { game, card, draft } = fixture();
    draft.selectedId = card.choices[1].id; draft.route = 'company';
    const model = game.view().models.find(m => m.id === card.ctx.modelId)!;
    expect(game.performAction('investigate_company', model.companyId).ok).toBe(true);
    const saved = game.serialize();
    const restored = validateTask(draft, game.view());
    expect(restored?.selectedId).toBe(draft.selectedId);
    expect(game.serialize()).toBe(saved);
  });
  it('safely drops invalid selection and scroll values in optional UI data', () => {
    const { game, draft } = fixture();
    expect(validateTask(null, game.view())).toBeNull();
    expect(validateTask('bad', game.view())).toBeNull();
    const restored = validateTask({ ...draft, selectedId: 'missing', route: 'unknown', reading: { section: 'missing', pane: 'bad', scroll: { brief: -1, evidence: Infinity, effects: '12' } } }, game.view());
    expect(restored?.selectedId).toBeNull();
    expect(restored?.route).toBe('decision');
    expect(restored?.reading).toEqual({ section: 'brief', pane: 'brief', scroll: { brief: 0, evidence: 0, effects: 0, options: 0 } });
  });
  it('previews the actual target relationship cost without consuming RNG', () => {
    const { game, card } = fixture();
    const model = game.view().models.find(m => m.id === card.ctx.modelId)!;
    const before = game.serialize();
    const target = game.getActions().find(a => a.id === 'investigate_company')!.targets!.find(t => t.id === model.companyId)!;
    const preview = target.preview!.find(p => p.key === 'company')!;
    expect(game.serialize()).toBe(before);
    const relation = game.view().companies.find(c => c.id === target.id)!.relation;
    const result = game.performAction('investigate_company', target.id);
    expect(result.ok).toBe(true);
    expect(game.view().companies.find(c => c.id === target.id)!.relation - relation).toBe(preview.amount);
  });
});
