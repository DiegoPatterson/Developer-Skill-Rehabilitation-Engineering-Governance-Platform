import { daysBetween } from "./dates";

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  streakFreezesLeft: number;
  lastFreezeUsedOn: string | null;
};

export type StreakUpdate = StreakState & {
  shieldsUsed: number;
  shieldEarned: boolean;
  alreadyCounted: boolean;
};

const FREEZE_CAP = 3;
export const FREEZE_REGEN_DAYS = 7;

export function applyActivity(state: StreakState, today: string): StreakUpdate {
  if (state.lastActiveDate === today) {
    return { ...state, shieldsUsed: 0, shieldEarned: false, alreadyCounted: true };
  }

  let current = state.currentStreak;
  let freezes = state.streakFreezesLeft;
  let shieldsUsed = 0;
  let lastFreezeUsedOn = state.lastFreezeUsedOn;
  let shieldEarned = false;

  if (lastFreezeUsedOn && daysBetween(lastFreezeUsedOn, today) >= FREEZE_REGEN_DAYS && freezes < FREEZE_CAP) {
    freezes += 1;
    shieldEarned = true;
    lastFreezeUsedOn = today;
  }

  let reset = false;
  if (state.lastActiveDate === null) {
    current = 1;
  } else {
    const missed = daysBetween(state.lastActiveDate, today) - 1;
    if (missed <= 0) {
      current += 1;
    } else if (freezes >= missed) {
      freezes -= missed;
      shieldsUsed = missed;
      lastFreezeUsedOn = today;
      current += 1;
    } else {
      current = 1;
      reset = true;
    }
  }

  if (reset) {
    if (freezes < FREEZE_CAP) shieldEarned = true;
    freezes = FREEZE_CAP;
    lastFreezeUsedOn = null;
  } else if (current > 0 && current % 7 === 0 && current !== state.currentStreak && freezes < FREEZE_CAP) {
    freezes += 1;
    shieldEarned = true;
  }

  return {
    currentStreak: current,
    longestStreak: Math.max(state.longestStreak, current),
    lastActiveDate: today,
    streakFreezesLeft: freezes,
    lastFreezeUsedOn,
    shieldsUsed,
    shieldEarned,
    alreadyCounted: false,
  };
}
