import { daysBetween } from "./dates";

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  streakFreezesLeft: number;
};

export type StreakUpdate = StreakState & {
  shieldsUsed: number;
  shieldEarned: boolean;
  alreadyCounted: boolean;
};

const FREEZE_CAP = 3;

export function applyActivity(state: StreakState, today: string): StreakUpdate {
  if (state.lastActiveDate === today) {
    return { ...state, shieldsUsed: 0, shieldEarned: false, alreadyCounted: true };
  }

  let current = state.currentStreak;
  let freezes = state.streakFreezesLeft;
  let shieldsUsed = 0;

  if (state.lastActiveDate === null) {
    current = 1;
  } else {
    const gap = daysBetween(state.lastActiveDate, today);
    const missed = gap - 1;
    if (missed <= 0) {
      current += 1;
    } else if (freezes >= missed) {
      freezes -= missed;
      shieldsUsed = missed;
      current += 1;
    } else {
      current = 1;
    }
  }

  let shieldEarned = false;
  if (current > 0 && current % 7 === 0 && current !== state.currentStreak && freezes < FREEZE_CAP) {
    freezes += 1;
    shieldEarned = true;
  }

  return {
    currentStreak: current,
    longestStreak: Math.max(state.longestStreak, current),
    lastActiveDate: today,
    streakFreezesLeft: freezes,
    shieldsUsed,
    shieldEarned,
    alreadyCounted: false,
  };
}
