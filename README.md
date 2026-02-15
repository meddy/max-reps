# Max Reps

A mobile-first workout tracking single-page app. Log exercises, build day templates, record sets, and view history. Built with React, TypeScript, Vite, and Firebase (Auth, Firestore, Hosting). Access is restricted to a single whitelisted Firebase user.

## Notes

- **UID whitelist:** If you use a different Firebase Auth user (e.g. another Google account), update the UID in both `.env` (`VITE_ALLOWED_UID`) and `firestore.rules` (the `isOwner()` comparison), then run `firebase deploy --only firestore:rules` so the new user can read and write data.
