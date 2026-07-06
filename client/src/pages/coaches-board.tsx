// =============================================================================
// Coaches Board — client/src/pages/coaches-board.tsx
// =============================================================================
// Embeds the Lion Board tactical whiteboard: a self-contained lacrosse
// coaching app that lives in ONE static file at client/public/coaches-board.html.
//
// Why an iframe instead of building it into React?
//   The board is its own complete app (it even works offline) maintained in a
//   separate project — github.com/neavesj88/lion-board. Embedding the file
//   same-origin means its saved plays (browser localStorage) work normally,
//   and updating it is just replacing one file:
//
//     ./scripts/update-coaches-board.sh     ← pulls the latest version
//
// The page fills everything below the navigation bar (the site footer is
// hidden on this route — see App.tsx) so coaches get a full-screen board.
// =============================================================================

export default function CoachesBoard() {
  return (
    <iframe
      src="/coaches-board.html"
      title="Coaches tactical whiteboard"
      // 100vh minus the sticky nav (h-16 = 4rem). No border — seamless.
      className="w-full block border-0"
      style={{ height: "calc(100vh - 4rem)" }}
      // The board needs no special permissions — plain drawing + localStorage.
      allow="fullscreen"
    />
  );
}
