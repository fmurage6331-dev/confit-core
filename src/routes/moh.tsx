/**
 * LabTrack — MOH layout route.
 *
 * This is a pathless-content layout for every /moh/* page. It renders
 * only <Outlet />, which is what actually lets /moh/705, /moh/706, etc.
 * display their own content instead of falling back to this route's
 * nearest rendered ancestor. The dashboard itself lives in moh.index.tsx
 * (the exact /moh path); each report page wraps itself in <AppShell>.
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/moh")({
  component: () => <Outlet />,
});
