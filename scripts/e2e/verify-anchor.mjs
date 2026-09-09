import fs from "node:fs";
import path from "node:path";

const jsPath =
  process.env.CTS_INDEX ||
  path.join(
    process.env.TEMP || "C:/Users/Admin/AppData/Local/Temp",
    "mimo-extract",
    "out",
    "renderer",
    "assets",
    "index-DKekZm7Y.js"
  );
const js = fs.readFileSync(jsPath, "utf8");
console.log("file", jsPath, "len", js.length);
for (const h of ['className:"cb-left"', 'className:"cb-right"', "composer-bar", "data-ctx-hud", "cb-left"]) {
  console.log(h, js.includes(h));
}
const i = js.indexOf('className:"cb-left"');
const j = js.indexOf('className:"cb-right"');
console.log("LEFT CTX:", js.slice(Math.max(0, i - 30), i + 160));
console.log("RIGHT CTX:", js.slice(Math.max(0, j - 40), j + 80));
// Find exact composer-bar children pattern
const m = js.match(/composer-bar[\s\S]{0,200}cb-left[\s\S]{0,250}cb-right/);
console.log("MATCH SNIPPET:", m ? m[0].slice(0, 400) : "NO MATCH");
