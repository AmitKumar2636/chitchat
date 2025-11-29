// Authentication service
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import { ref, set, update, serverTimestamp } from 'firebase/database';
import { auth, db } from './firebase';

export type AuthUser = User;

/**
 * Signs up a new user with email, password, and display name.
 *
 * @param email - User's email address
 * @param password - User's password
 * @param displayName - User's display name
 * @returns Promise resolving to the created User object
 */
export async function signUp(email: string, password: string, displayName: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Update profile with display name
  await updateProfile(user, { displayName });

  // Create user document in Realtime Database with initial presence state
  const userRef = ref(db, `users/${user.uid}`);
  await set(userRef, {
    email: user.email,
    displayName,
    createdAt: serverTimestamp(),
    isOnline: true, // User is online when they sign up
    lastSeen: serverTimestamp(),
  });

  return user;
}

/**
 * Signs in an existing user with email and password.
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise resolving to the signed-in User object
 */
export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Ensure user document exists in Realtime Database with presence fields
  const userRef = ref(db, `users/${user.uid}`);
  await update(userRef, {
    email: user.email,
    displayName: user.displayName || email.split('@')[0],
    isOnline: true, // User is online when they sign in
    lastSeen: serverTimestamp(),
  });

  return user;
}

/**
 * Signs out the current user.
 *
 * @returns Promise resolving when sign-out is complete
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Subscribes to authentication state changes.
 *
 * @param callback - Function called when auth state changes
 * @returns Unsubscribe function
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
