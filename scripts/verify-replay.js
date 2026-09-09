import { readFileSync } from "node:fs";
import { createGame, applyCommand, RULES_VERSION } from "../src/engine.js";

const file = process.argv[2];
if (!file) {
  console.error("用法：node scripts/verify-replay.js <回放.json>");
  process.exit(1);
}
try {
  const replay = JSON.parse(readFileSync(file, "utf8"));
  if (replay.rulesVersion !== RULES_VERSION || !Array.isArray(replay.commands))
    throw new Error("回放格式或版本不匹配");
  const state = replay.commands.reduce(applyCommand, createGame(replay.seed));
  console.log(
    JSON.stringify(
      {
        revision: state.revision,
        turn: state.turn,
        winner: state.winner,
        players: state.players,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`回放校验失败：${error.message}`);
  process.exit(1);
}
