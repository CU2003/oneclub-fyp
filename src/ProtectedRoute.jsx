// wrapper component with React Router's <Navigate /> to guard routes
// was shown by common "protected route" patterns in the React Router documentation
// and tutorials, then adapted for this project.
// Protected Routes / Authentication patterns. - https://reactrouter.com/
// this file protects certain pages e.g. admin - so only logged-users can see

import React from "react";
import { Navigate } from "react-router-dom"; // redirect to another page
import { useAuth } from "./AuthContext.jsx"; // // logged in users from authcontext

// emails allowed to access admin match console - possible change further down, be pulled from somewhere else
const ADMIN_EMAILS = [
    "kilbrittaingaa@oneclub.com",
    "ballygunnergaa@oneclub.com",
];

function ProtectedRoute({ children }) { // wraps around any page we want to protect
  const { currentUser } = useAuth(); // gets logged in user


  if (!currentUser) {
    return <Navigate to="/admin-login" replace />; // not logged in - goes to admin login page
  }

  const isAdmin = ADMIN_EMAILS.includes(currentUser.email); // checks if log in email is in admin list

    // not logged in, shows a message where not allowed to update - to be changed further down the line possibly
  if (!isAdmin) {
    return (
      <main className="page">
        <p style={{ marginTop: "2rem", textAlign: "center" }}>
          You are logged in as <strong>{currentUser.email}</strong> but
          not authorised to update matches.
        </p>
      </main>
    );
  }

  return children; // if logged in and approved admin, shows admin page
}

export default ProtectedRoute;
