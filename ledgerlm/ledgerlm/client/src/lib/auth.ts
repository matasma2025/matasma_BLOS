import { useState, useEffect } from 'react';

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

// SG-85: Auth state stored in memory only — never in localStorage or sessionStorage.
// On page refresh, ProtectedRoute (App.tsx) falls back to GET /api/auth/me which
// derives identity from the server-side HttpOnly session cookie.
//
// NOTE: device_token (remember-device for OTP skip) intentionally stays in
// localStorage — it is a device fingerprint, not a session credential. The server
// validates it independently and it cannot be used to bypass session auth.
let _authUser: AuthUser | null = null;
const AUTH_CHANGE_EVENT = 'ledgerlm_auth_change';

export function setAuthUser(user: AuthUser) {
  _authUser = user;
  // Notify all components in this tab of the auth change
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function getAuthUser(): AuthUser | null {
  return _authUser;
}

export function clearAuthUser() {
  _authUser = null;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

/**
 * React hook that provides reactive access to current auth user.
 * Updates automatically when user logs in/out within the same tab.
 */
export function useAuthUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(getAuthUser());

  useEffect(() => {
    const handleAuthChange = () => {
      setUser(getAuthUser());
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    };
  }, []);

  return user;
}
