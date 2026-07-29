/*
 * STAR ASCENT CROSS-CHANNEL RELEASE PACKET VALIDATOR
 * Version 0.1 — 27 July 2026
 *
 * LOCAL, DETERMINISTIC QA ONLY. This module compares supplied public copy for
 * the website, pinned announcement, and livestream. It makes no network calls,
 * handles no wallet or secret material, and cannot approve a launch.
 */

export const RELEASE_SURFACES = Object.freeze([
  "website",
  "pinnedAnnouncement",
  "livestream",
]);

export const RELEASE_FIELDS = Object.freeze([
  "projectName",
  "launchStatus",
  "mintAddress",
  "tokenProgram",
  "decimals",
  "supplyBaseUnits",
  "mintAuthorityState",
  "freezeAuthorityState",
  "registrationStatus",
  "safetyNotice",
]);

const launchCriticalFields = new Set([
  "mintAddress",
  "tokenProgram",
  "decimals",
  "supplyBaseUnits",
  "mintAuthorityState",
  "freezeAuthorityState",
]);

const pendingValues = new Set([
  "PENDING",
  "NOT PUBLISHED",
  "UNVERIFIED",
]);

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requirePublicText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be non-empty public text`);
  }
  return value.trim();
}

function isPending(value) {
  return pendingValues.has(value.toUpperCase());
}

export function validateCrossChannelReleasePacket(packet) {
  const input = requireRecord(packet, "release packet");
  if (input.lifecycle !== "pre-launch") {
    throw new Error("lifecycle must remain pre-launch");
  }
  if (input.readinessDecision !== "HOLD") {
    throw new Error("readiness decision must remain HOLD");
  }

  const canonical = requireRecord(input.canonical, "canonical fields");
  const surfaces = requireRecord(input.surfaces, "release surfaces");
  const normalizedCanonical = new Map();

  for (const field of RELEASE_FIELDS) {
    normalizedCanonical.set(
      field,
      requirePublicText(canonical[field], `canonical.${field}`),
    );
  }

  for (const surfaceName of RELEASE_SURFACES) {
    const surface = requireRecord(surfaces[surfaceName], surfaceName);
    for (const field of RELEASE_FIELDS) {
      const value = requirePublicText(
        surface[field],
        `${surfaceName}.${field}`,
      );
      if (value !== normalizedCanonical.get(field)) {
        throw new Error(
          `cross-channel mismatch for ${field} on ${surfaceName}`,
        );
      }
    }
  }

  const unresolvedCriticalCount = [...launchCriticalFields].filter((field) =>
    isPending(normalizedCanonical.get(field)),
  ).length;

  return Object.freeze({
    channelCount: RELEASE_SURFACES.length,
    fieldCount: RELEASE_FIELDS.length,
    networkChecked: false,
    readinessDecision: "HOLD",
    unresolvedCriticalCount,
  });
}
