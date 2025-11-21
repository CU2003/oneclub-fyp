
// puts React into <div id="root"> and enables client-side touting with BrowserRouter
// Use BrowserRouter so the URL can change without reloading the page.

import React from "react"; // main library for UI building
import ReactDOM from "react-dom/client"; // connects reacts to the web page
import { BrowserRouter } from "react-router-dom"; // allows multiple urls - e.g league

import App from "./App.jsx"; // main app component
import "./index.css"; // global css styles for the whole app
import { AuthProvider } from "./AuthContext.jsx"; // authprovider shares logged in user across the app

ReactDOM.createRoot(document.getElementById("root")).render( // finds div id root in index.html + tells react how to draw it
  <React.StrictMode>  {/* strict mode helps catch potential problems in dev*/}
    <AuthProvider> {/* AuthProvider wraps the web app so all components can access currentUser via useAuth() */}
      <BrowserRouter> {/* wraps web app so we can use routes - url - without page reloads*/}
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);

