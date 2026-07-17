// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig(({ command }) => {
  // Ensure Lovable dev-only runtime hooks are disabled during production builds.
  // This helps avoid build-time attempts to contact the Lovable dev-server (/dev-server)
  // which cause "Could not load /dev-server" errors in Lovable CI.
  if (command === "build") {
    // Some Lovable plugins and our build pipeline check for LOVABLE_DEV
    // or similar env flags; setting this here helps ensure dev-only
    // integrations are not activated during the production build.
    process.env.LOVABLE_DEV = "false";
    process.env.NODE_ENV = process.env.NODE_ENV || "production";
  }

  return {
    tanstackStart: {
      server: { entry: "server" },
    },
    vite: {
      // keep mcpPlugin as before; additional Lovable dev plugins are provided by
      // the `@lovable.dev/vite-tanstack-config` package and will be gated there.
      plugins: [mcpPlugin()],
    },
  };
});
