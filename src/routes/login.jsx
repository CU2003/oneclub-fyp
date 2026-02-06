// page where supporters can create an account or log into an existing one
// uses firebase authentication to handle login and signup securely

// reference: https://firebase.google.com/docs/auth/web/password-auth
// firebase password authentication to let users log in or create accounts.
// lines 37-43

import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

// user story 6
export default function Login() {
  // tracking whether user wants to sign up or log in
  const [isSignUp, setIsSignUp] = useState(false);
  // storing what the user types in the email field
  const [email, setEmail] = useState("");
  // storing what the user types in the password field
  const [password, setPassword] = useState("");

  // keeping track of any error messages to show the user
  const [error, setError] = useState("");
  // tracking if we're currently processing the login/signup request
  const [loading, setLoading] = useState(false);

  // function to move the user to a different page after successful login
  const navigate = useNavigate();

  // handling when the user submits the form
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        // creating a new account with firebase
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // logging into an account that already exists
        await signInWithEmailAndPassword(auth, email, password);
      }

      // user profile gets created automatically by authcontext
      navigate("/"); // taking user to the home page
    } catch (err) {
      console.error(err);
      // showing the error message to the user
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "3rem auto", padding: "1.5rem" }}>
      {/* title changes based on whether user is signing up or logging in */}
      <h2 style={{ marginBottom: "1rem" }}>
        {isSignUp ? "Create an account" : "Log in"}
      </h2>

      {/* form that collects email and password */}
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

        {/* showing error message if something went wrong */}
        {error && (
          <div style={{ color: "crimson", fontSize: "0.9rem" }}>
            {error}
          </div>
        )}

        {/* submit button that's disabled while processing */}
        <button type="submit" disabled={loading} style={{ padding: "0.7rem" }}>
          {loading ? "Please wait..." : isSignUp ? "Sign up" : "Log in"}
        </button>
      </form>

      {/* button to switch between login and signup modes */}
      <button
        type="button"
        onClick={() => setIsSignUp((v) => !v)}
        style={{ marginTop: "1rem", padding: "0.7rem", width: "100%" }}
      >
        {isSignUp ? "Already have an account? Log in" : "No account? Sign up"}
      </button>
    </div>
  );
}
