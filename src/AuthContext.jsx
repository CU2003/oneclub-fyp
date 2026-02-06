// https://firebase.google.com/docs/auth/web/manage-users#web_8
// This documentation explains how onAuthStateChanged keeps React state in sync with Firebase,
// which I adapted here to store and share the current logged-in user across the web app.
// created a shared authcontext for the whole webapp
// tracks logged in users // loads fs profiles // updates in real time

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

// listen to the user's firestore profile doc (users/{uid})
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

// this creates users/{uid} for new supporters automatically
import { ensureUserDoc } from "./userService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);

  // store the firestore profile doc for the logged-in user (users/{uid})
  const [userDoc, setUserDoc] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUserDoc = null; // holds firestore listener cleanup

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      try {
        // Clean up any previous Firestore subscription when auth state changes
        if (unsubUserDoc) {
          unsubUserDoc();
          unsubUserDoc = null;
        }

        if (user) {
          // Ensure profile doc exists (supporter/admin creation)
          await ensureUserDoc(user);

          // watch the user's profile in the database so we know instantly when they add favourites
          unsubUserDoc = onSnapshot(
            // point to their profile document using their user ID
            doc(db, "users", user.uid),
            // every time their profile changes, grab the document ID and all their data
            (snap) => {
              setUserDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
            },
            // if something goes wrong reading their profile, log the error and clear it
            (err) => {
              console.error("Error reading Firestore user profile:", err);
              setUserDoc(null);
            }
          );
        } else {
          // nobody is logged in, so clear their profile data
          setUserDoc(null);
        }

        // save who is logged in (or null if nobody is)
        setCurrentUser(user);
      } catch (err) {
        // if something broke, log it but still update the user state
        console.error("Error in auth listener:", err);
        setCurrentUser(user);
        setUserDoc(null);
      } finally {
        setLoading(false);
      }
    });

    // when the component is removed, stop all the listeners to prevent memory leaks
    return () => {
      if (unsubUserDoc) unsubUserDoc();
      unsubAuth();
    };
  }, []);

  // expose userDoc so pages can read favourites, role, etc.
  const value = { currentUser, userDoc };

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading…</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

//reference: https://eslint.org/docs/latest/use/configure/rules#disabling-rules
// it was retinrning an error and suggested the line below to block it and suggested this so i looked up online what ut does.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
