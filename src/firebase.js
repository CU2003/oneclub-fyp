// sets up firebase connection for the web app, using settings from enc.local
// auth is for sign-in and roles e.g. admin - iteration 2
// db is for firestore where fixtures and tables are stored - live events to be done.
// reference https://www.youtube.com/watch?v=ig91zc-ERSE&t=140s
// assisted me with the setting up of firebase/firestore
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// used to start the project
// real values in .env.local
const app = initializeApp({ // creates the single firebase app instance OneClub will use
  apiKey: import.meta.env.VITE_FB_API_KEY, // project identifier
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN, // redirects pages - PLANNED ITERATION
  projectId: import.meta.env.VITE_FB_PROJECT_ID, // firebase id
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET, //Firebase storage - PLANNED ITERATION, CLUB CRESTS, IMAGES ETC.
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID, // push notfications - PLANNED ITERATION
  appId: import.meta.env.VITE_FB_APP_ID, // Firebase id from web app
});


// exported into other files so rest of the web app use
export const auth = getAuth(app); // to be used for further iterations - e.g. verification backlog - ITERATION 2
export const db = getFirestore(app); // storage of fixtures, tables etc. PLANNED ITERATION, SOON TO BE LIVE EVENTS!!!!