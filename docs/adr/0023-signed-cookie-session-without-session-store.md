# ADR-0023: Keep the session in a signed cookie holding the user id, without a session store

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-25
- **Related:** PRD US-1; ADR-0001, ADR-0004; specs/project-foundation

## Context

After email login (ADR-0001) the API must recognise the user on every request, and the session must survive a browser refresh. The foundation scope has only a `users` table, and identity must stay behind one boundary that real authentication can replace later.

## Decision

On login, the API sets a signed, httpOnly cookie (`SameSite=Lax`, `Secure` outside development, 30-day max age) holding the user id, signed with `COOKIE_SECRET`. There is no sessions table. One Fastify plugin reads the cookie, loads the user and decorates `request.user`; business routes only use that plugin's guard. Logout clears the cookie. A valid cookie for a user who no longer exists is treated as unauthenticated and cleared.

## Alternatives considered

- **Server-side sessions table** — rejected for now: enables revocation, but adds a table and cleanup with no value while identity itself is unauthenticated.
- **JWT in localStorage + `Authorization` header** — rejected: exposed to XSS, and the frontend would have to manage token lifecycle.
- **Session library with a store (e.g. `@fastify/session`)** — rejected for the same reason as a sessions table.

## Consequences

- Sessions cannot be revoked server-side; logout only removes the cookie from that browser.
- Rotating `COOKIE_SECRET` logs everyone out, which is acceptable with disposable MVP data (ADR-0004).

## Debt

- **Shortcut taken:** stateless signed-cookie session, no server-side session store or revocation.
- **Why accepted:** identity is already unauthenticated (ADR-0001), so a stronger session adds no real security now.
- **Risk while open:** a copied cookie works until it expires or the secret rotates.
- **Repayment trigger:** together with ADR-0001, before the app is opened beyond the internal test group.
- **Repayment sketch:** replace the plugin with a real auth mechanism (magic link or OAuth) and a server-side session store with revocation; business routes keep using the same `request.user` guard.
