import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const src = readFileSync(new URL("../lib/rom/bps.ts", import.meta.url), "utf8");
const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
writeFileSync(new URL("../public/randomizer/bps.mjs", import.meta.url), out);
