import type { Auth } from "firebase/auth";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import type { AuthClientPort } from "./authClientPort";

export function createFirebaseAuthClientPort(auth: Auth): AuthClientPort {
  return {
    onAuthStateChanged(callback) {
      return onAuthStateChanged(auth, callback);
    },
    async signInWithGoogle() {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signOut() {
      return firebaseSignOut(auth);
    },
  };
}
