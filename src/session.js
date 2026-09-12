import { normalizeParticipants } from "./identity.js";
import { createGame, applyCommand, canEndTurn, RULES_VERSION } from "./engine.js";

/** UI depends only on getSnapshot / subscribe / send / dispose.
 * A remote session can implement the same interface with server-owned snapshots.
 */
export class LocalSession {
  #state;
  #participants;
  #listeners = new Set();
  #disposed = false;
  #commands = [];
  constructor(seed = 1, { participants = [], difficulty = "advanced" } = {}) {
    this.#participants = normalizeParticipants(participants);
    this.seed = seed;
    this.difficulty=["easy","advanced","master"].includes(difficulty)?difficulty:"advanced";
    this.#state = createGame(seed);
  }
  static restore(replay) {
    if(replay?.rulesVersion!==RULES_VERSION||!Array.isArray(replay.commands))throw new Error('存档版本不兼容');
    const session=new LocalSession(replay.seed,{participants:replay.participants,difficulty:replay.difficulty});
    for(const command of replay.commands){session.#state=applyCommand(session.#state,command);session.#commands.push(structuredClone(command));}
    return session;
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
  async send(command, {timeout=false}={}) {
    if (this.#disposed) throw new Error("对局已关闭");
    if(command.type==="end" && !timeout && !canEndTurn(this.#state))throw new Error("当前不能结束回合");
    this.#state = applyCommand(this.#state, command);
    this.#commands.push(structuredClone(command));
    for (const listener of this.#listeners) listener(this.getSnapshot());
    return this.getSnapshot();
  }
  exportSave(){return {...this.exportReplay(),participants:this.getParticipants(),difficulty:this.difficulty};}
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
