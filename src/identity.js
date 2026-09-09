export const DEFAULT_NAMES = ["玩家一", "玩家二"];
export const NAME_LIMIT=10;
const segments=new Intl.Segmenter("zh",{granularity:"grapheme"});
export function shortName(value) {
 const clean=typeof value==="string"?value.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,"").trim():"";
 return Array.from(segments.segment(clean),s=>s.segment).slice(0,NAME_LIMIT).join("");
}
export function normalizeParticipants(participants = []) {
  return DEFAULT_NAMES.map((fallback, seat) => {
    const value = participants[seat]?.displayName;
    return { seat, displayName: shortName(value) || fallback };
  });
}
export const playerName = (participants, seat) => normalizeParticipants(participants)[seat].displayName;
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
