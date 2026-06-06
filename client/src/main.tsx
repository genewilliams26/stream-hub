import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// stream-hub is a dark-first, kiosk/TV experience.
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(<App />);
