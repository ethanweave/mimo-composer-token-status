import fs from "node:fs";
import path from "node:path";

const js = fs.readFileSync(
  path.join(process.env.TEMP || "C:/Users/Admin/AppData/Local/Temp", "mimo-extract/out/renderer/assets/index-DKekZm7Y.js"),
  "utf8"
);

const i = js.indexOf("function A0e(");
console.log(js.slice(i, i + 900));

console.log("\n==== usageByConvo context 837800 ====");
console.log(js.slice(837700, 841600));
