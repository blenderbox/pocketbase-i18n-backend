import { build } from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";

/** @type{import("esbuild").BuildOptions} */
const options = {
  bundle: true,
  entryPoints: ["src/index.ts"],
  format: "esm",
  keepNames: true,
  minify: true,
  outdir: "lib",
  plugins: [
    nodeExternalsPlugin({
      dependencies: false,
    }),
  ],
  sourcemap: true,
  target: ["node16"],
};

build(options).catch((error) => {
  console.error(error);

  process.exit(1);
});
