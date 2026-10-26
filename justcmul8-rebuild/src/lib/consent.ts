// DPDP consent record, kept in the user's auth metadata (no schema change needed).
// Bump CONSENT_VERSION when the Terms or Privacy Policy change in a way users must accept again.
export const CONSENT_VERSION = "2026-10-26";

export interface ConsentRecord {
  version: string;
  acceptedAt: string; // ISO time
  adult: true; // confirmed 18 or older
}

export const consentRecord = (): ConsentRecord => ({ version: CONSENT_VERSION, acceptedAt: new Date().toISOString(), adult: true });

export const hasConsent = (meta: unknown) => typeof (meta as { consent?: ConsentRecord } | null)?.consent?.version === "string";
