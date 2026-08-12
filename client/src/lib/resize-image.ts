// =============================================================================
// SHRINKING PHOTOS BEFORE UPLOAD — client/src/lib/resize-image.ts
// =============================================================================
// WHAT THIS IS
// Takes the photo somebody picked and makes a smaller copy of it, in their own
// browser, before it is sent to the website.
//
// WHY IT EXISTS
// A photo straight off a modern phone is around 4,000 pixels wide and several
// megabytes. Nothing on this website ever displays an image wider than about
// 1,600 pixels, so the rest is downloaded by every single visitor and then
// thrown away. A gallery of ten untouched phone photos is a 40 MB page — on a
// phone at a ground that is the difference between a site that works and one
// that gives up.
//
// Club volunteers upload straight from their phones, as they should. This
// makes that the right thing to do rather than something they have to know
// about.
//
// It also makes the UPLOAD faster, which is the part the volunteer actually
// waits for.
//
// SHOULD A CLUB EDIT THIS FILE?  No.
// If photos ever look soft, raise MAX_WIDTH or QUALITY below — but check the
// file sizes afterwards.
// =============================================================================

/** Nothing on the site displays an image wider than this. */
const MAX_WIDTH = 1600;

/** JPEG quality. 0.82 is the usual sweet spot: no visible loss, huge saving. */
const QUALITY = 0.82;

/** Below this, resizing costs more than it saves, so the file is left alone. */
const SKIP_UNDER_BYTES = 300 * 1024;

/**
 * Make a smaller version of an image file.
 *
 * In: the file the user chose. Out: a smaller File, or the ORIGINAL file
 * unchanged if it is already small, is a format we shouldn't touch, or if
 * anything goes wrong.
 *
 * Never throws. A failed resize must still let the upload proceed — a slightly
 * heavy photo on the site is a far better outcome than a volunteer being told
 * their photo won't upload.
 */
export async function shrinkImage(file: File): Promise<File> {
  // GIFs are usually animated, and drawing one to a canvas would silently
  // reduce it to a single still frame. PNGs of logos and crests are left alone
  // too: they are already small, and re-encoding them as JPEG would add a
  // background where the transparency used to be.
  if (file.type === "image/gif" || file.type === "image/png") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.size < SKIP_UNDER_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);

    // Already small enough — sending it through the canvas would only lose
    // quality for no benefit.
    if (bitmap.width <= MAX_WIDTH) {
      bitmap.close();
      return file;
    }

    const scale = MAX_WIDTH / bitmap.width;
    const canvas = document.createElement("canvas");
    canvas.width = MAX_WIDTH;
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) return file;

    // Occasionally a small or already-compressed image comes out bigger. Keep
    // whichever is actually smaller.
    if (blob.size >= file.size) return file;

    // Rename to .jpg, because the contents are now a JPEG whatever the
    // original was called. The server picks the extension from the file type
    // anyway, but a mismatched name would confuse anyone reading the folder.
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Very old browser, an image format the browser can't decode, or a photo
    // too large to fit in memory. Upload the original.
    return file;
  }
}

/** "3.4 MB" — for telling the user what just happened to their photo. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
