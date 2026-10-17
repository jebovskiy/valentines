import { EventEmitter } from 'node:events';
import type { Valentine } from './database';

/**
 * In-process pub/sub for companion SSE streams.
 *
 * The `/stream` endpoint used to poll the database every 5s per connected
 * device (~1000 queries/s at 5k devices). New valentines are now pushed to the
 * open streams of the same process immediately; a slower poll remains as a
 * fallback so streams still catch up across instances.
 */
const emitter = new EventEmitter();
// One listener per connected companion device; the default cap of 10 would
// warn and leak for every pair after the tenth device.
emitter.setMaxListeners(0);

export function emitCompanionValentine(pairId: string, valentine: Valentine): void {
  emitter.emit(pairId, valentine);
}

/** Subscribes to new-valentine events for a pair; returns an unsubscribe fn. */
export function onCompanionValentine(pairId: string, listener: (valentine: Valentine) => void): () => void {
  emitter.on(pairId, listener);
  return () => {
    emitter.off(pairId, listener);
  };
}
