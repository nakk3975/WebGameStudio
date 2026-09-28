import fs from "node:fs/promises";
import path from "node:path";
import { build } from "vite";
// The hosted app splits the editor. Offline HTML needs a separate, single bundle.
const dir = path.resolve("output/standalone-dist");
await build({
  define: { "import.meta.env.VITE_API_BASE_URL": "undefined", "import.meta.env.VITE_AUTH_URL": "undefined" },
  build: {
    outDir: dir,
    cssCodeSplit: false,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
let html = await fs.readFile(dir + "/index.html", "utf8");
for (const match of [
  ...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g),
]) {
  const code = await fs.readFile(path.join(dir, match[1]), "utf8");
  html = html.replace(
    match[0],
    () =>
      '<script type="module">' +
      code.replace(/<\/script/gi, "<\\/script") +
      "</script>",
  );
}
for (const match of [
  ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g),
]) {
  const css = await fs.readFile(path.join(dir, match[1]), "utf8");
  html = html.replace(match[0], () => "<style>" + css + "</style>");
}
const notices = await fs.readFile("assets/THIRD_PARTY_NOTICES.txt", "utf8");
html = html.replace(
  "</head>",
  () =>
    "<!-- Third-party licenses\n" +
    notices.replace(/--/g, "- -") +
    "\n-->\n</head>",
);
await fs.mkdir("output", { recursive: true });
await fs.writeFile("output/GhostDesk_Play.html", html);
console.log(
  "Standalone file: output/GhostDesk_Play.html (" +
    Buffer.byteLength(html) +
    " bytes)",
);
