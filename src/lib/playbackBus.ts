export interface PlaybackTickPayload {
  mode: 'campaign' | 'tour';
  /** 0..100 */
  percent: number;
  /** 1-based unlocked sequential route count during campaign phase */
  unlockedSteps: number;
}

type Listener = (payload: PlaybackTickPayload) => void;

const listeners = new Set<Listener>();

export function emitPlaybackTick(payload: PlaybackTickPayload): void {
  listeners.forEach((fn) => fn(payload));
}

export function subscribePlaybackTick(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
