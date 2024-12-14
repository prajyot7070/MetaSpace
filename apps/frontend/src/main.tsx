import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
  <Auth0Provider
    domain="dev-a1jxmtjamisacs8d.us.auth0.com"
    clientId="RZiCqF7kp0bdLOJe4tek033GoSnmYXPt"
    authorizationParams={{
      redirect_uri: "http://localhost:5173/callback",
    }}
  >
    <BrowserRouter>
    <App />
    </ BrowserRouter>
  </Auth0Provider>,
  </React.StrictMode>
);

