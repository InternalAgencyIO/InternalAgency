export const PUBLIC_NETWORK_STATE = Object.freeze({
  status: "HOLD",
  cluster: "mainnet-beta",
  networkLabel: "Solana Mainnet Beta",
  genesisAtUtc: null,
  mint: null,
  programId: null,
});

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function classifyLookup(value) {
  const normalized = String(value ?? "").trim();
  if (!BASE58.test(normalized)) return { kind: "invalid", value: normalized };
  if (normalized.length >= 80 && normalized.length <= 90) {
    return { kind: "signature", value: normalized };
  }
  if (normalized.length >= 32 && normalized.length <= 44) {
    return { kind: "address", value: normalized };
  }
  return { kind: "invalid", value: normalized };
}

export function explorerUrl(kind, value) {
  const path = kind === "signature" ? "tx" : "address";
  return `https://explorer.solana.com/${path}/${encodeURIComponent(value)}`;
}

export function decodePositionAccount(encoded) {
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  if (bytes.byteLength !== 168) throw new Error("UNEXPECTED_POSITION_ACCOUNT_SIZE");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u64 = (offset) => view.getBigUint64(offset, true).toString();
  return {
    positionId: u64(72),
    principalBaseUnits: u64(80),
    acceptedWeek: u64(88),
    firstAccrualWeek: u64(96),
    termWeeks: u64(104),
    annualRateBps: u64(112),
    treasuryReservedBaseUnits: u64(120),
    ecosystemReservedBaseUnits: u64(128),
    liquidityReservedBaseUnits: u64(136),
    paidBaseUnits: u64(144),
    settledMask: u64(152),
    agencyIndex: view.getUint32(160, true),
    role: view.getUint8(164),
    principalReturned: view.getUint8(165) === 1,
    closed: view.getUint8(166) === 1,
  };
}
