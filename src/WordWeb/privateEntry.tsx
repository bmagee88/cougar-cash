// This entry is built separately and delivered only after server authentication.
// Never import this entry or WordWeb into the public SPA module graph.
import React from "react";
import { createRoot } from "react-dom/client";
import WordWeb from "./WordWeb";

const host = document.getElementById("word-web-private-root");
if (!host) throw new Error("Word Web host is unavailable.");
const root = createRoot(host);
root.render(<WordWeb />);
window.addEventListener("word-web:lock", () => root.unmount(), { once: true });
