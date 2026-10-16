import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "../miniapp/node_modules/typescript/lib/typescript.js";

const root = fileURLToPath(new URL("../miniapp/", import.meta.url));
function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory())
      return ["node_modules", ".ai-mode-skills", "skills"].includes(entry.name)
        ? []
        : sources(file);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")
      ? [file]
      : [];
  });
}
function build() {
  let count = 0;
  for (const file of sources(root)) {
    const result = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2018,
        module: ts.ModuleKind.CommonJS,
        sourceMap: true,
        inlineSources: true,
      },
      reportDiagnostics: true,
    });
    const errors = (result.diagnostics || []).filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    );
    if (errors.length)
      throw new Error(
        ts.formatDiagnosticsWithColorAndContext(errors, {
          getCanonicalFileName: (x) => x,
          getCurrentDirectory: () => root,
          getNewLine: () => "\n",
        }),
      );
    const output = file.replace(/\.ts$/, ".js");
    fs.writeFileSync(output, result.outputText);
    fs.writeFileSync(output + ".map", result.sourceMapText);
    count++;
  }
  console.log(
    `Miniapp TypeScript: generated ${count} runtime files beside sources.`,
  );
}
build();
if (process.argv.includes("--watch")) {
  let timer;
  fs.watch(root, { recursive: true }, (_event, file) => {
    if (
      !file ||
      !file.endsWith(".ts") ||
      file.split(/[\\/]/).includes("node_modules")
    )
      return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        build();
      } catch (error) {
        console.error(error.message);
      }
    }, 200);
  });
  console.log(
    "Watching TypeScript sources; WeChat DevTools reloads generated JavaScript.",
  );
}
