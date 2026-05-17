# Single-Owner Architecture

Max Reps is a personal-use app with exactly one user, the **Owner**. All data access is gated on a hardcoded UID configured in `VITE_ALLOWED_UID` (client) and `firestore.rules` (server). There is no notion of "users" in the data model: documents don't carry a `userId`, queries don't scope by user, and security rules don't model roles or sharing.

## Consequences

Adding a second user (or sharing) is a non-trivial migration. Every existing document would need a `userId` field; every query would need user-scoping; security rules would need rewriting; the auth flow would need account-management UI. The decision is deliberate to keep the data model small for a single-author project. Reasoning is recorded here so a future reader doesn't try to "fix" the missing multi-tenancy without understanding the trade-off.
