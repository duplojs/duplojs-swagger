import {writeFileSync} from "fs";
import {resolve} from "path";
import * as d from "./descriptors";

const workDir = process.cwd();

writeFileSync(
	resolve(workDir, "globals.d.ts"),
	`
export {};
declare global {
	${Object.keys(d).map(v => `const ${v}: typeof import("./types/descriptors.d.ts")["${v}"]`).join(";\n\t")};
}
`
);
