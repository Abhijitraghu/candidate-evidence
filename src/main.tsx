import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import App from "./App";
import "./style.css";

const url = import.meta.env.VITE_CONVEX_URL;
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {url ? <ConvexProvider client={new ConvexReactClient(url)}><App /></ConvexProvider> :
      <main><h1>Connect to Convex first</h1><p>Set CONVEX_URL in .env.local to your development deployment address, then restart npm run dev.</p></main>}
  </React.StrictMode>,
);
