import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` must match the repo name for GitHub Pages project sites
// (https://<user>.github.io/<repo>/). Update this if you rename the repo.
export default defineConfig({
  plugins: [react()],
  base: "/pulsetracker-lite/",
});
