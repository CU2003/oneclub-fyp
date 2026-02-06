// Reference: https://chatgpt.com/share/6973641b-71a4-8004-9597-83210984a170
// used chat gpt above to help understand how to import club data from a json file into friestore
// without inputting it manually. took code direclty from chat gpt while also looking at
// https://stackoverflow.com/questions/46640981/how-to-import-csv-or-json-to-firebase-cloud-firestore? and
// https://firebase.google.com/docs/firestore/manage-data/add-data?


// This script automatically imports Cork GAA club data from a JSON file into  Firestore.
// Instead of manually adding each club one by one, this script reads all the club information
// from a JSON file and creates documents in the Firestore database. It organizes clubs by division,
// adds timestamps, and can be run multiple times safely without creating duplicates. This saves
// a lot of time when setting up the database with club data.

import admin from "firebase-admin"; // firebase admin sdk gives full access to the database
import fs from "fs";                // reading files from the computer
import path from "path";            // building file paths that work on any computer
import { fileURLToPath } from "url"; // needed because we're using ES modules instead of CommonJS

// fixing __dirname for ES modules - node doesn't give us this automatically
// we need it to find files relative to where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This key gives ADMIN access to Firestore.
// It proves this script belongs to the project owner.
//
// The key file is stored locally and ignored by Git.
const serviceAccountPath = path.join(
  __dirname,
  "keys",
  "serviceAccountKey.json"
);

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf8")
);


// INITIALISE FIREBASE ADMIN SDK
// This creates a secure connection to Firestore
// using admin permissions.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore(); // Firestore database reference


// This file contains Cork clubs grouped by division.

const dataPath = path.join(__dirname, "data", "cork-clubs.json");
const rawData = fs.readFileSync(dataPath, "utf8");
const clubsByDivision = JSON.parse(rawData);


// Firestore document IDs should be lowercase,
// URL-safe, and consistent.

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // replace spaces & symbols with "-"
    .replace(/(^-|-$)+/g, "");   // remove leading/trailing "-"
}


// MAIN IMPORT FUNCTION
async function importClubs() {
  console.log("Reading cork-clubs.json...");
  console.log("Found divisions:", Object.keys(clubsByDivision).join(", "));

  let totalImported = 0;

  // Loop through each division (e.g. Carbery)
  for (const division of Object.keys(clubsByDivision)) {
    const clubs = clubsByDivision[division];

    // Loop through each club in the division
    for (const club of clubs) {
      const clubName = club.name;
      const clubId = slugify(clubName); // Firestore document ID

      // Firestore document structure for each club
      const clubDoc = {
        name: clubName,
        division: division,
        county: "Cork",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Write club to Firestore:
      // Collection: "clubs"
      // Document ID: slugified club name
      await db.collection("clubs").doc(clubId).set(clubDoc, {
        merge: true, // allows safe re-runs without overwriting everything
      });

      console.log(
        `✔ ${division}: ${clubName} -> clubs/${clubId}`
      );

      totalImported++;
    }
  }

  console.log(`✅ Done. Imported/updated ${totalImported} clubs.`);
}


// This starts the import process when the file is run
// using:
// node scripts/importCorkClubsToFirestore.js
importClubs().catch((err) => {
  console.error("❌ Error importing clubs:", err);
});
