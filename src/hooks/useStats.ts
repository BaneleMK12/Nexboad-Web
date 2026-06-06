import { useState, useCallback } from "react";

export type GameKey = "chess" | "checkers" | "othello" | "morabaraba" | "tictactoe";
export interface Stats { wins: number; losses: number; draws: number }

function key(game: GameKey) { return `nexboard_stats_${game}`; }

function load(game: GameKey): Stats {
  try {
    const raw = localStorage.getItem(key(game));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { wins: 0, losses: 0, draws: 0 };
}

function save(game: GameKey, s: Stats) {
  try { localStorage.setItem(key(game), JSON.stringify(s)); } catch {}
}

export function useStats(game: GameKey) {
  const [stats, setStats] = useState<Stats>(() => load(game));

  const recordWin = useCallback(() => {
    setStats(prev => {
      const next = { ...prev, wins: prev.wins + 1 };
      save(game, next); return next;
    });
  }, [game]);

  const recordLoss = useCallback(() => {
    setStats(prev => {
      const next = { ...prev, losses: prev.losses + 1 };
      save(game, next); return next;
    });
  }, [game]);

  const recordDraw = useCallback(() => {
    setStats(prev => {
      const next = { ...prev, draws: prev.draws + 1 };
      save(game, next); return next;
    });
  }, [game]);

  const reset = useCallback(() => {
    const next = { wins: 0, losses: 0, draws: 0 };
    save(game, next); setStats(next);
  }, [game]);

  return { stats, recordWin, recordLoss, recordDraw, reset };
}

export function loadAllStats(): Record<GameKey, Stats> {
  const games: GameKey[] = ["chess", "checkers", "othello", "morabaraba", "tictactoe"];
  const result = {} as Record<GameKey, Stats>;
  for (const g of games) result[g] = load(g);
  return result;
}
