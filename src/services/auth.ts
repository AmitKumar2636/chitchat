// Authentication service
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export type AuthUser = User;

export async function signUp(email: string, password: string, displayName: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Update profile with display name
  await updateProfile(user, { displayName });

  // Create user document in Firestore with initial presence state
  await setDoc(doc(db, 'users', user.uid), {
    email: user.email,
    displayName,
    createdAt: serverTimestamp(),
    isOnline: true, // User is online when they sign up
    lastSeen: serverTimestamp(),
  });

  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Ensure user document exists in Firestore with presence fields
  await setDoc(
    doc(db, 'users', user.uid),
    {
      email: user.email,
      displayName: user.displayName || email.split('@')[0],
      createdAt: serverTimestamp(),
      isOnline: true, // User is online when they sign in
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  ); // merge: true won't overwrite existing fields like createdAt

  return user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
