/** Per-user, per-item boundary answer. */
export type Answer = 'yes' | 'maybe' | 'no';

/** How permissive the pool computation is. Default is the strictest. */
export type PoolMode = 'both-yes' | 'yes-and-maybe' | 'maybe-and-maybe';

export interface ItemAnswers {
  itemId: string;
  /** Partner A's private answer. Never exposed to Partner B (invariant #5). */
  a: Answer;
  /** Partner B's private answer. Never exposed to Partner A (invariant #5). */
  b: Answer;
}
