type StorageHost = Pick<Window, "localStorage" | "sessionStorage">;

// Confirmed obsolete keys only. Never clear all storage: OTP state, preferences,
// logout signalling and IndexedDB device-proof keys must remain untouched.
const LEGACY_AUTH_KEYS = ["ledgerlm_user", "device_token"] as const;

export function clearLegacyAuthStorage(storageHost: StorageHost = window): void {
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = storageHost[storageName];
      for (const key of LEGACY_AUTH_KEYS) {
        try {
          storage.removeItem(key);
        } catch {
          // One failed removal must not prevent cleanup of another key.
        }
      }
    } catch {
      // Storage may be blocked. Authentication still uses the server session,
      // never these legacy values, so cleanup must not interrupt login/logout.
    }
  }
}
