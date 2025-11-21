// src/routes/AdminLogin.jsx

// this page lets an admin log into the system using email and password

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

// create boxes in memory to store what the user types
// email, password and error message if login fails
function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate(); // lets the user move to a different page in the web app

  // runs when the page first loads
  // clears any old email, password or error in case they are left there
  useEffect(() => {
    setEmail("");
    setPassword("");
    setError("");
  }, []);

  // function runs when form is submitted - login
  const handleSubmit = async (e) => {
    e.preventDefault(); // stops browser from refreshing page
    setError(""); // clears old messaged before trying again

    // login pattern gathered based from Firebase Authentication docs
    // used to assist me with login: Line 33-47, https://firebase.google.com/docs/auth/web/password-auth
    // Iteration 2 - used for assitance with login and how to call signInWithEmailAndPassword
    try {
      // tries signing in using Firebase
      await signInWithEmailAndPassword(auth, email, password);

      // Clears the fields once they’ve signed in - no email or passwords left around
      setEmail("");
      setPassword("");

      // Go to the admin console if login successful
      navigate("/admin");
    } catch (err) { // log the error to the browser console for debugging
      console.error(err);
      setError("Login failed. Please check your email and password."); // shows the error message on screen for admin
    }
  };

  // HTML form structure gathered from W3Schools: HTML Forms, https://www.w3schools.com/html/html_forms.asp Lines: 53 - 103 ~
  // used to adapy fit React JSX and the design of my admin page
  // what admin sees on the screen
  return (
    <div style={{ maxWidth: 400, margin: "2rem auto" }}>
      <h2>Admin Login</h2>
      <p>Only authorised club admins can update match scores.</p>

      {/* login form, tells the browser not to auto fill details if possible*/}
      <form onSubmit={handleSubmit} autoComplete="off">
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="admin-email">
            Email
            <input
              id="admin-email"
              //  name is set to customer value so the browser is less likely to autosave it
              name="admin-email"
              type="email"
              autoComplete="off" // turns off auto complete
              value={email}
              onChange={(e) => setEmail(e.target.value)} // when the user types, update the email state
              required
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </label>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="admin-password">
            Password
            <input
              id="admin-password"
              name="admin-password"
              type="password"
              autoComplete="new-password" //  new-password tells many browsers not to reuse old saved password
              value={password} // the value in the box comes from password state
              onChange={(e) => setPassword(e.target.value)} // when user types, updates password state
              required
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </label>
        </div>

        {/* If there is an error message, show it in red text */}
        {error && (
          <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>
        )}

         {/* Button to submit the form and try to log in */}
        <button type="submit" style={{ padding: "0.5rem 1rem" }}>
          Login
        </button>
      </form>
    </div>
  );
}

export default AdminLogin;
