// this file handles user-related database operations
// it creates user profiles when someone first logs in, assigns admin or supporter roles,
// and manages the favourites system (adding and removing clubs from a user's favourites list)
// it uses an allow-list to determine which email addresses should be admins
// all other users automatically become supporters



import { doc, getDoc, serverTimestamp, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "./firebase";

// list of email addresses that should have admin access
// added competitionType and competitionId to tell the system which competition each admin manages
// competitionType = "championship" or "league" (tells us which collection to use in firestore)
// competitionId = e.g. "munster-championship" or "sigerson-cup" (tells us which specific competition)
// this lets each admin only create and update games for their own competition
const ADMIN_PROFILES = {
  "ballygunnergaa@oneclub.com": { 
    club: "Ballygunner_ID",
    competitionType: "championship",
    competitionId: "munster-championship"
  },
  "kilbrittaingaa@oneclub.com": { 
    club: "Kilbrittain_ID",
    competitionType: "championship",
    competitionId: "munster-championship"
  },
  "uccgaa@oneclub.com": {
    club: "UCC_ID",
    competitionType: "championship",
    competitionId: "sigerson-cup"
  },
};

// reference: https://chatgpt.com/share/6973e7eb-9d38-8004-aa6d-5c0d5d37b303
// making sure every user has a profile in the database
// creates a new profile if one doesn't exist, or fixes the role if it's wrong
export async function ensureUserDoc(user) {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  // cleaning up the email and checking if it's in the admin list
  const email = (user.email ?? "").toLowerCase().trim();
  const adminProfile = ADMIN_PROFILES[email];
  const isAdmin = Boolean(adminProfile);

  if (!snap.exists()) {
    // user doesn't have a profile yet, so create one
    await setDoc(userRef, {
      email,
      role: isAdmin ? "admin" : "supporter",
      admin: isAdmin, // keeping this for backwards compatibility
      club: isAdmin ? adminProfile.club : null,
      // reference: https://chatgpt.com/share/69863241-da6c-8004-b905-14311d38b234
      // lines 58-59, 91-96, 110-115 - got help with updating admin profile creation to include competitionType and competitionId
      // this ensures each admin has their competition info saved so the system knows where to save their games
      // save which competition this admin manages
      // this tells the system where to save games when the admin creates them
      competitionType: isAdmin && adminProfile.competitionType ? adminProfile.competitionType : null,
      competitionId: isAdmin && adminProfile.competitionId ? adminProfile.competitionId : null,

      // starting with empty arrays for favourites and followed matches
      favouriteClubIds: [],
      followedMatchIds: [],

      createdAt: serverTimestamp(),
    });
  } else {
    // user already has a profile
    const existingData = snap.data();

    // do NOT downgrade roles automatically.
    // If an account was promoted to admin in Firestore manually, we keep it.
    // We only "auto-upgrade" known admin emails from ADMIN_PROFILES.
    const updates = {};

    // Always ensure arrays exist
    if (!Array.isArray(existingData.favouriteClubIds)) {
      updates.favouriteClubIds = [];
    }
    if (!Array.isArray(existingData.followedMatchIds)) {
      updates.followedMatchIds = [];
    }

    // Upgrade known admin emails if needed
    if (isAdmin && existingData.role !== "admin") {
      updates.role = "admin";
      updates.admin = true;
      updates.club = adminProfile.club;
      // reference: https://chatgpt.com/share/69863241-da6c-8004-b905-14311d38b234
      // lines 91-96 - got help with ensuring competition info is saved when upgrading existing users to admin
      // also save the competition info when upgrading to admin
      // this makes sure the admin can create games in the right place
      if (adminProfile.competitionType) {
        updates.competitionType = adminProfile.competitionType;
      }
      if (adminProfile.competitionId) {
        updates.competitionId = adminProfile.competitionId;
      }
    }
    
    // If this is a known admin email, ensure required admin fields exist even if
    // the account was manually promoted to admin in Firestore.
    // This fixes cases where UI depends on `club` being present (e.g. Create Fixture button).
    if (isAdmin && adminProfile.club && !existingData.club) {
      updates.club = adminProfile.club;
    }

    // reference: https://chatgpt.com/share/69863241-da6c-8004-b905-14311d38b234
    // lines 110-115 - got help with updating database, to add competition info to existing admin profiles
    // this ensures admins created before competition info was added will still work correctly
    // Also update competition info if admin profile has it and user doc doesn't
    // make sure all admins have their competition info saved
    // this fixes cases where an admin account was created before we added competition info
    // without this, the admin wouldn't be able to create games because the system wouldn't know where to save them
    if (isAdmin && adminProfile.competitionType && !existingData.competitionType) {
      updates.competitionType = adminProfile.competitionType;
    }
    if (isAdmin && adminProfile.competitionId && !existingData.competitionId) {
      updates.competitionId = adminProfile.competitionId;
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates);
    }
  }
}

// Reference: lines 70-83, https://firebase.google.com/docs/firestore/manage-data/add-data
// user story 7 - adding a club to the user's favourites list
// uses arrayUnion so it won't add duplicates even if called multiple times
// this is called when a supporter clicks the favourite button on a club page
export async function addFavouriteClub(uid, clubId) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    favouriteClubIds: arrayUnion(clubId),
  });
}

// user story 7 - removing a club from the user's favourites list
// uses arrayRemove to safely delete it from the array
// this is called when a supporter clicks the favourite button again to unfavourite
export async function removeFavouriteClub(uid, clubId) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    favouriteClubIds: arrayRemove(clubId),
  });
}
