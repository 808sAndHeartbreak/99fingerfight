export const DEFAULT_NAMES = ["玩家一", "玩家二"];
export function normalizeParticipants(participants = []) {
  return DEFAULT_NAMES.map((fallback, seat) => {
    const value = participants[seat]?.displayName;
    const clean = typeof value === "string" ? value.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim() : "";
    return { seat, displayName: Array.from(clean).slice(0, 24).join("") || fallback };
  });
}
export const playerName = (participants, seat) => normalizeParticipants(participants)[seat].displayName;
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
