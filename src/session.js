import { normalizeParticipants } from "./identity.js";
import { createGame, applyCommand, RULES_VERSION } from "./engine.js";

/** UI depends only on getSnapshot / subscribe / send / dispose.
 * A remote session can implement the same interface with server-owned snapshots.
 */
export class LocalSession {
  #state;
  #participants;
  #listeners = new Set();
  #disposed = false;
  #commands = [];
  constructor(seed = 1, { participants = [] } = {}) {
    this.#participants = normalizeParticipants(participants);
    this.seed = seed;
    this.#state = createGame(seed);
  }
  getParticipants() {
    return structuredClone(this.#participants);
  }
  rename(seat,displayName) {
    this.#participants=normalizeParticipants(this.#participants.map((p,i)=>i===seat?{displayName}:p));
  }
  getSnapshot() {
    return structuredClone(this.#state);
  }
  subscribe(listener) {
    this.#listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.#listeners.delete(listener);
  }
  async send(command) {
    if (this.#disposed) throw new Error("对局已关闭");
    this.#state = applyCommand(this.#state, command);
    this.#commands.push(structuredClone(command));
    for (const listener of this.#listeners) listener(this.getSnapshot());
    return this.getSnapshot();
  }
  exportReplay() {
    return {
      rulesVersion: RULES_VERSION,
      seed: this.seed,
      commands: structuredClone(this.#commands),
    };
  }
  dispose() {
    this.#disposed = true;
    this.#listeners.clear();
  }
}
