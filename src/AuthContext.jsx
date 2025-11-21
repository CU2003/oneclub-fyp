// https://firebase.google.com/docs/auth/web/manage-users#web_8
// This documentation explains how onAuthStateChanged keeps React state in sync with Firebase,
// which I adapted here to store and share the current logged-in user across the web app.
// created a shared authcontext for the whole webapp
// It keeps track of which user is logged in - currentUser
// and makes the info available to any compnent that needs it

import React, {
  createContext,
  useEffect,
  useState
} from "react";

// lets us listen for login and log out changes in Firebase
import { onAuthStateChanged } from "firebase/auth";
// our firebase auth object - connection to firebase authentication
import { auth } from "./firebase";

// creates a new context object to hold our auth info - shared box for currentUser that whole web app can read
const AuthContext = createContext(null);

// component that wraps around tthe whole web app in main.jsx - listens for firebase login changes and provides currenUser to children.
export function AuthProvider({ children }) {

  // currentUser stores logged-in user object from Firebase
  // listens for firebase login changes and provides currentUser to children
  const [currentUser, setCurrentUser] = useState(null);

  // loading is true while we are waiting to hear from firebase about whether someone is logged in or not
  const [loading, setLoading] = useState(true);


  // useEffect runs when web app starts
  // sets up a listener to watch for auth changes - login or logout
  useEffect(() => {
    // onAuthStatechanged runs callback everytime the auth state changes e.g. web app loads, user logs in and logs out
    const unsub = onAuthStateChanged(auth, (user) => {
      // user is a firebase user object or null if logged out
      setCurrentUser(user);
       // once we get first answer from firebase, we know if someone logged in so we can stop loading
      setLoading(false);
    });
    return () => unsub(); // cleanup function - unsubscribes listener when compnent unmounts so not listening when web app closes
  }, []); // empty array means only runs when compnent mounts

  // value shared with the rest of the web app - only currentUser atm - could add further in iterations
  const value = { currentUser };

  // while waiting to hear from firebase - shows a loading... message
  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Loading…
      </div>
    );
  }

  // once loading complete, actual web app shown
  // children gets wrapped in AuthContext.Provider so any component inside can use useAuth to get currentUser
  // supplies values to child components. I adapted this for sharing the logged-in user
  // across the whole app.  Lines 62 - 65
  // https://www.w3schools.com/REACT/react_props_children.asp
  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}



