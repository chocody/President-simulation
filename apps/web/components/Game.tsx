"use client";

import { useCallback, useEffect, useState } from "react";
import type { Answer, Difficulty } from "@ps/shared";
import type { InfoResponse } from "../lib/api-types";
import { api, ApiClientError } from "../lib/client-api";
import { clearSaved, loadSaved, saveGame, type SavedGame } from "../lib/storage";
import { DecisionScreen } from "./DecisionScreen";
import { EndingScreen } from "./EndingScreen";
import { MainScreen } from "./MainScreen";
import { ResultScreen } from "./ResultScreen";
import { CharterScreen, StartScreen } from "./StartScreen";

const msg = (e: unknown): string =>
  e instanceof ApiClientError ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";

/** Screen state machine. The whole game lives in `game` (and localStorage); the server is stateless. */
export default function Game() {
  const [booted, setBooted] = useState(false);
  const [game, setGame] = useState<SavedGame | null>(null);
  const [meta, setMeta] = useState<InfoResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((next: SavedGame | null) => {
    setGame(next);
    if (next) saveGame(next);
    else clearSaved();
  }, []);

  useEffect(() => {
    setGame(loadSaved());
    setBooted(true);
    api.info().then(setMeta).catch((e) => setError(msg(e)));
  }, []);

  const run = useCallback(async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }, []);

  if (!booted) {
    return <div className="p-6 text-muted" role="status">กำลังโหลด…</div>;
  }

  // Start screen
  if (!game) {
    return (
      <StartScreen
        meta={meta}
        busy={busy}
        error={error}
        onStart={(difficulty: Difficulty) =>
          run(async () => {
            const { state, info } = await api.newGame(difficulty);
            update({ v: 1, state, info, screen: "charter", card: null, result: null, ending: null, log: [] });
          })
        }
      />
    );
  }

  const { state, info } = game;

  const restart = () => {
    setError(null);
    update(null);
  };

  if (game.screen === "charter") {
    return <CharterScreen state={state} info={info} onAccept={() => update({ ...game, screen: "main" })} />;
  }

  if (game.screen === "decision" && game.card) {
    const card = game.card;
    return (
      <DecisionScreen
        key={card.id + state.quarter}
        state={state}
        info={info}
        card={card}
        busy={busy}
        error={error}
        onSubmit={(answer: Answer) =>
          run(async () => {
            const result = await api.decide(state, answer);
            update({ ...game, state: result.state, screen: "result", result, card: null });
          })
        }
      />
    );
  }

  if (game.screen === "result" && game.result) {
    return (
      <ResultScreen
        info={info}
        result={game.result}
        onContinue={() => update({ ...game, screen: "main", result: null })}
      />
    );
  }

  if (game.screen === "ending" && game.ending) {
    return <EndingScreen state={state} info={info} ending={game.ending} onRestart={restart} />;
  }

  // Main screen. Also the recovery path when a saved screen lacks its data (e.g. an edited save).
  const advance = () =>
    run(async () => {
      if (state.phase === "ended") {
        const ending = await api.end(state);
        update({ ...game, screen: "ending", ending, card: null });
        return;
      }
      const res = await api.advance(state);
      if (res.state.phase === "ended") {
        const ending = await api.end(res.state);
        update({ ...game, state: res.state, screen: "ending", ending, card: null, log: res.log, news: res.news });
      } else if (res.state.phase === "decision" && res.card) {
        update({ ...game, state: res.state, screen: "decision", card: res.card, log: res.log, news: res.news });
      } else {
        update({ ...game, state: res.state, screen: "main", log: res.log, news: res.news });
      }
    });

  return <MainScreen state={state} info={info} log={game.log} news={game.news} busy={busy} error={error} onAdvance={advance} />;
}
