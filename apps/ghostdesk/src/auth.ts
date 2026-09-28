import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthVanillaAdapter } from "@neondatabase/auth/vanilla/adapters";
// Same-origin proxy: managed sessions do not depend on third-party cookies.
const url = import.meta.env.VITE_AUTH_URL;
export const authClient = url
  ? createAuthClient(new URL(url, window.location.origin).href, {
      adapter: BetterAuthVanillaAdapter({
        fetchOptions: { credentials: "include", timeout: 15000 },
      }),
    })
  : null;
