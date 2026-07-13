// Minimal shared route constants for paths generated/redirected to in more
// than one place. Not a full route registry — just the paths this PR needs
// to keep in sync so links and redirects can't drift from the router again.
export const ROUTES = {
  GUEST_LOGIN: '/guest/login',
  GUEST_INFO: '/guest/info',
  GUEST_RSVP: (token) => `/guest/rsvp/${token}`,
}
