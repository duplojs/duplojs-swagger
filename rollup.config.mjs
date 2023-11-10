import {defineConfig} from "rollup";
import esbuild from "rollup-plugin-esbuild";
import json from "@rollup/plugin-json";

export default defineConfig([
	{
		input: "scripts/",
		output: [
			{
				file: "dist/.mjs",
				format: "esm"
			},
			{
				file: "dist/.cjs",
				format: "cjs",
			}
		],
		plugins: [
			esbuild({
				include: /\.[jt]sx?$/,
				exclude: /node_modules/,
				tsconfig: "tsconfig.json",
			}),
			json(),
		]
	},
]);
