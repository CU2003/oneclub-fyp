// page where someone can sign up as a reporter (email and password).
// creates a firebase auth user then writes their firestore profile with role "pending-reporter" so an admin can approve them.
// once approved manually (by changing their role to "reporter" in firestore) they can access the reporter dashboard.
// the cloud function sendReporterSignupEmail (functions/index.js) listens for new users with role "pending-reporter" and sends an email to conor.
// references: firebase auth https://firebase.google.com/docs/auth, firestore https://firebase.google.com/docs/firestore
// full approval flow and setup: https://chatgpt.com/share/69a71491-1c60-8004-9ced-fbd6221f28db
// linked files: App.jsx, firebase, login.jsx.


import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";

export default function ReporterSignup() {
  // state: form fields, any error message, and whether we're submitting
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // on submit: create auth user, then set their firestore profile to "pending-reporter".
  // that document creation triggers the cloud function which emails conor so he can approve them.
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;
      const emailTrim = (user.email ?? "").toLowerCase().trim();

      // write users/{uid} with role "pending-reporter". the cloud function (onDocumentCreated on users/{uid}) runs and sends the approval email.
      await setDoc(
        doc(db, "users", user.uid),
        {
          role: "pending-reporter",
          email: emailTrim,
          favouriteClubIds: [],
          followedMatchIds: [],
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // optional: also write to mail collection for debugging or if you add another email path later. the real email is sent by the cloud function.
      await addDoc(collection(db, "mail"), {
        to: "conor.usti@icloud.com",
        message: {
          subject: "OneClub - new reporter signup request",
          text: `A new reporter has signed up with email: ${emailTrim}.

To approve them, open the Firebase console, go to Firestore -> users collection,
find this user, and change their role field from "pending-reporter" to "reporter".`,
        },
        createdAt: serverTimestamp(),
      });

      // after signup go to home; their account is waiting for approval until admin changes role to "reporter"
      navigate("/");
    } catch (err) {
      // on failure show error message (e.g. email already in use, weak password) and stop loading
      console.error(err);
      setError(err.message ?? "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "3rem auto", padding: "1.5rem" }}>
      <h2 style={{ marginBottom: "0.5rem" }}>Reporter sign up</h2>
      <p style={{ marginBottom: "1rem", fontSize: "0.95rem", opacity: 0.85 }}>
        Create an account to write reports for OneClub.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@email.com"
            style={{ padding: "0.6rem" }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Minimum 6 characters"
            style={{ padding: "0.6rem" }}
          />
        </label>

        {/* show error message if sign up failed (e.g. email in use, weak password) */}
        {error && (
          <div style={{ color: "crimson", fontSize: "0.9rem" }}>{error}</div>
        )}

        {/* submit button disabled while loading so they can't double-submit */}
        <button type="submit" disabled={loading} style={{ padding: "0.7rem" }}>
          {loading ? "Please wait..." : "Sign up as reporter"}
        </button>
      </form>

      {/* link to login page if they already have an account */}
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        Already have an account?{" "}
        <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
