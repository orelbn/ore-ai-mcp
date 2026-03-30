import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!(rootElement instanceof HTMLDivElement)) {
  throw new Error("Missing #root element for Local MCP Dev UI.");
}

createRoot(rootElement).render(<App />);
