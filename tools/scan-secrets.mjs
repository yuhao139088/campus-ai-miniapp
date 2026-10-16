import { execFileSync } from "node:child_process";
import fs from "node:fs";
const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const patterns = [
  /sk-(?:sp-)?[A-Za-z0-9_.-]{25,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /AKID[A-Za-z0-9]{25,}/g,
];
const failures = [];
for (const file of paths) {
  if (
    /(?:\.env(?:\.|$)|\.cache\/|AI交接\/)/.test(file) &&
    file !== ".env.example"
  )
    failures.push(`${file}: private artifact tracked`);
  if (/\.(png|jpg|jpeg|webp|ico|woff2?)$/.test(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (
    patterns.some((p) => {
      p.lastIndex = 0;
      return p.test(text);
    })
  )
    failures.push(`${file}: potential credential`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `Secret scan passed: ${paths.length} tracked files; no values printed.`,
);
