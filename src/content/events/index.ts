/**
 * Aggregates all scripted events (GDD §11). Each theme lives in its own module;
 * id prefixes: lab_, ai_, soc_, eco_, pol_, wld_, mil_, arc_.
 */
import type { EventDef } from '../../engine/types';
import { LAB_EVENTS } from './labs';
import { AI_EVENTS } from './ai';
import { SOCIETY_EVENTS } from './society';
import { ECONOMY_EVENTS } from './economy';
import { POLITICS_EVENTS } from './politics';
import { WORLD_EVENTS } from './world';
import { MILITARY_EVENTS } from './military';
import { ARC_EVENTS } from './arcs';

export const EVENTS: EventDef[] = [
  ...LAB_EVENTS,
  ...AI_EVENTS,
  ...SOCIETY_EVENTS,
  ...ECONOMY_EVENTS,
  ...POLITICS_EVENTS,
  ...WORLD_EVENTS,
  ...MILITARY_EVENTS,
  ...ARC_EVENTS,
];

export { LAB_EVENTS, AI_EVENTS, SOCIETY_EVENTS, ECONOMY_EVENTS, POLITICS_EVENTS, WORLD_EVENTS, MILITARY_EVENTS, ARC_EVENTS };
