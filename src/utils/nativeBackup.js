/**
 * Saving a backup from the iPhone app.
 *
 * On the web a backup is saved by clicking a download link, which an app's web
 * view does not do. So the app writes the very same JSON to its own cache
 * folder and opens the iPhone share sheet, where "Save to Files" (or AirDrop,
 * Mail, …) keeps it wherever the user chooses. Restoring is unchanged: the file
 * picker reads that file back exactly as it reads one saved from the web.
 *
 * The plugins are imported only when this runs, so the web app never loads
 * them.
 */
export async function shareBackupFile(filename, json) {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  try {
    await Share.share({ title: 'Forge backup', files: [uri] });
  } catch (err) {
    // Closing the sheet without choosing anywhere is not a failure.
    if (/cancel/i.test(String(err?.message || err))) return 'cancelled';
    throw err;
  }
  return 'shared';
}
