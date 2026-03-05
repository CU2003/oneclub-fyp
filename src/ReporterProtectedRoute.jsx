// reporter protected route: only users with role "reporter" can see the reporter dashboard.
// if not logged in we send them to /login. if role is "pending-reporter" we show a message that they are waiting for approval.
// all other roles see a "not authorised" message. part of the reporter signup approval flow.
// reference for the full flow: https://chatgpt.com/share/69a71491-1c60-8004-9ced-fbd6221f28db
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

function ReporterProtectedRoute({ children }) {
  const { currentUser, userDoc } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const role = userDoc?.role;
  const isReporter = role === "reporter";
  const isPendingReporter = role === "pending-reporter";

  // show waiting message until admin changes their role to "reporter" in firestore
  if (isPendingReporter) {
    return (
      <main className="page">
        <p style={{ marginTop: "2rem", textAlign: "center" }}>
          Your reporter account for <strong>{currentUser.email}</strong> is waiting for approval.
          Once an admin changes your role to "reporter" in Firestore you will be able to use the reporter dashboard.
        </p>
      </main>
    );
  }

  if (!isReporter) {
    return (
      <main className="page">
        <p style={{ marginTop: "2rem", textAlign: "center" }}>
          You are logged in as <strong>{currentUser.email}</strong> but
          not authorised to use the reporter dashboard.
        </p>
      </main>
    );
  }

  return children;
}

export default ReporterProtectedRoute;
