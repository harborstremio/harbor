// New context menu copy remains usable until each locale provides an override.
const contextActionsFallback: Record<string, string> = {
  "Anime watched changes are not synced to this provider. Manage progress there.":
    "Anime watched changes are not synced to this provider. Manage progress there.",
  "Checking watched status…": "Checking watched status…",
  "Watched status unavailable": "Watched status unavailable",
  "{watched} of {total} released episodes known watched":
    "{watched} of {total} released episodes known watched",
  "Could not check watched status: {providers}": "Could not check watched status: {providers}",
  "Delete local copy only": "Delete local copy only",
  "Harbor will check your account and remove this collection there if it exists, then remove the local collection. Other account collections are preserved.":
    "Harbor will check your account and remove this collection there if it exists, then remove the local collection. Other account collections are preserved.",
  "Local-only deletion removes this collection from this device. Any copy in your Harbor account remains unchanged; its current status has not been verified.":
    "Local-only deletion removes this collection from this device. Any copy in your Harbor account remains unchanged; its current status has not been verified.",
  "Retry account check": "Retry account check",
  "The account collection data could not be read safely.":
    "The account collection data could not be read safely.",
  "The Harbor account changed while reading its collections.":
    "The Harbor account changed while reading its collections.",
  "The Harbor account collections could not be read.":
    "The Harbor account collections could not be read.",
  "The Harbor account could not be verified.": "The Harbor account could not be verified.",
  "The server did not confirm access to your complete account collections.":
    "The server did not confirm access to your complete account collections.",
  "Your Harbor account copy could not be checked. Nothing was deleted. You can retry, or delete only the local copy and leave any account copy unchanged.":
    "Your Harbor account copy could not be checked. Nothing was deleted. You can retry, or delete only the local copy and leave any account copy unchanged.",
  "Updated: {providers}.": "Updated: {providers}.",
  "No changes were made.": "No changes were made.",
  "Harbor watchlist cache": "Harbor watchlist cache",
  "Stremio cleared this title's history for the previous account. The active profile or account changed; the current view was kept.":
    "Stremio cleared this title's history for the previous account. The active profile or account changed; the current view was kept.",
  "Simkl removal also deletes watched history. Manage this title in Simkl.":
    "Simkl removal also deletes watched history. Manage this title in Simkl.",
  "This title already has a Simkl status. Change its status in Simkl.":
    "This title already has a Simkl status. Change its status in Simkl.",
  "No verified Trakt identity is available for this title.":
    "No verified Trakt identity is available for this title.",
  "No verified Simkl identity is available for this title.":
    "No verified Simkl identity is available for this title.",
  "Unchanged: Simkl removal also deletes watched history. Manage this title in Simkl.":
    "Unchanged: Simkl removal also deletes watched history. Manage this title in Simkl.",
  "Unchanged: this title already has a Simkl status. Change its status in Simkl.":
    "Unchanged: this title already has a Simkl status. Change its status in Simkl.",
  "This title cannot be synced to Stremio's watchlist.":
    "This title cannot be synced to Stremio's watchlist.",
  "No verified Trakt episode mapping is available for this anime.":
    "No verified Trakt episode mapping is available for this anime.",
  "Simkl cannot unwatch a movie without removing it from its library. Manage this title in Simkl.":
    "Simkl cannot unwatch a movie without removing it from its library. Manage this title in Simkl.",
  "Unchanged: Simkl cannot unwatch a movie without removing it from its library. Manage this title in Simkl.":
    "Unchanged: Simkl cannot unwatch a movie without removing it from its library. Manage this title in Simkl.",
  "Anime episode watched state is not synced to Stremio.":
    "Anime episode watched state is not synced to Stremio.",
  "No Stremio identity is available for this title.":
    "No Stremio identity is available for this title.",
  "The selected episodes could not be aligned with Stremio's episode list.":
    "The selected episodes could not be aligned with Stremio's episode list.",
  "The Trakt account or session changed. Open the menu again.":
    "The Trakt account or session changed. Open the menu again.",
  "The current Trakt watched state could not be read safely.":
    "The current Trakt watched state could not be read safely.",
  "Trakt repeated a watched-state page. No Trakt history was added.":
    "Trakt repeated a watched-state page. No Trakt history was added.",
  "The complete Trakt watched state could not be checked. No Trakt history was added.":
    "The complete Trakt watched state could not be checked. No Trakt history was added.",
  "The server did not confirm your profile. Reload it before making changes.":
    "The server did not confirm your profile. Reload it before making changes.",
  "Your profile items could not be read safely. No changes were made.":
    "Your profile items could not be read safely. No changes were made.",
  "Sign in to publish your collections.": "Sign in to publish your collections.",
  "The active profile or Harbor account changed. Reopen the collection action.":
    "The active profile or Harbor account changed. Reopen the collection action.",
  "The Harbor account changed. Reopen the collection action.":
    "The Harbor account changed. Reopen the collection action.",
  "The server response did not confirm the requested collections. Your local collections were kept; refresh the published collection before retrying.":
    "The server response did not confirm the requested collections. Your local collections were kept; refresh the published collection before retrying.",
  "The server accepted the collection changes, but the local profile or account changed. Reopen the collection to reconcile its state.":
    "The server accepted the collection changes, but the local profile or account changed. Reopen the collection to reconcile its state.",
  "Files were deleted, but the download record could not be removed. Retry removal.":
    "Files were deleted, but the download record could not be removed. Retry removal.",
  "The download record could not be removed. Retry removal.":
    "The download record could not be removed. Retry removal.",
  "{provider}: {reason}": "{provider}: {reason}",
  "{n} versions on home servers": "{n} versions on home servers",
  "A local library entry changed. Open the menu again.":
    "A local library entry changed. Open the menu again.",
  Actions: "Actions",
  "Choose episode": "Choose episode",
  "Choose source for this episode": "Choose source for this episode",
  "Choose version": "Choose version",
  "Choose version to download": "Choose version to download",
  "Download is unavailable.": "Download is unavailable.",
  "Download this version": "Download this version",
  "Manage home servers": "Manage home servers",
  "No local files are selected.": "No local files are selected.",
  "Play this file": "Play this file",
  "Play this version": "Play this version",
  "Playback is unavailable.": "Playback is unavailable.",
  "Remove {count} entries from library; keep files":
    "Remove {count} entries from library; keep files",
  "Remove {count} entries from the local library? Files on disk are kept.\n\n{title}":
    "Remove {count} entries from the local library? Files on disk are kept.\n\n{title}",
  "Remove from library; keep file": "Remove from library; keep file",
  "The library change could not be saved. Your entries and files were kept.":
    "The library change could not be saved. Your entries and files were kept.",
  "This local file is missing or is not a regular file.":
    "This local file is missing or is not a regular file.",
  "This local file is no longer available.": "This local file is no longer available.",
  "This local library entry changed. Open the menu again.":
    "This local library entry changed. Open the menu again.",
  "This server connection changed. Choose a source again.":
    "This server connection changed. Choose a source again.",
  "This server connection is no longer available.":
    "This server connection is no longer available.",
  "This server episode is no longer available.": "This server episode is no longer available.",
  "This server item is no longer available.": "This server item is no longer available.",
  "This server version changed. Choose a source again.":
    "This server version changed. Choose a source again.",
  "{done} completed, {failed} failed, {skipped} changed or unavailable.":
    "{done} completed, {failed} failed, {skipped} changed or unavailable.",
  "{visible} visible downloads of {all} total": "{visible} visible downloads of {all} total",
  "{visible} visible of {all} downloads": "{visible} visible of {all} downloads",
  "A movie cannot have an episode watched action.":
    "A movie cannot have an episode watched action.",
  "A profile update is already in progress.": "A profile update is already in progress.",
  "Add to list or collection": "Add to list or collection",
  "Add to my profile": "Add to my profile",
  "All {count} downloads for this series": "All {count} downloads for this series",
  "Already added": "Already added",
  'Already in "{name}"': 'Already in "{name}"',
  "Already in my profile": "Already in my profile",
  "An update is already in progress.": "An update is already in progress.",
  "Cancel {count} downloads": "Cancel {count} downloads",
  "Cancel {count} downloads? Partial files are kept.\n\n{scope}":
    "Cancel {count} downloads? Partial files are kept.\n\n{scope}",
  "Choose a download source again to retry this item.":
    "Choose a download source again to retry this item.",
  "Choose a download source again; this item's source cannot be recovered.":
    "Choose a download source again; this item's source cannot be recovered.",
  "Choose one explicit episode scope.": "Choose one explicit episode scope.",
  "Clear Stremio watch history for this title?": "Clear Stremio watch history for this title?",
  "Clear Stremio watch history for this title…": "Clear Stremio watch history for this title…",
  "Clear title history": "Clear title history",
  "Clearing Stremio history is not supported for this title ID.":
    "Clearing Stremio history is not supported for this title ID.",
  Comment: "Comment",
  "Confirm delete comment": "Confirm delete comment",
  "Copy comment text": "Copy comment text",
  "Copy game link": "Copy game link",
  "Copy image": "Copy image",
  "Copy image is unavailable here. Save the image instead.":
    "Copy image is unavailable here. Save the image instead.",
  "Copy image link": "Copy image link",
  "Copy post text": "Copy post text",
  "Copy profile link": "Copy profile link",
  "Copy selected text": "Copy selected text",
  "Copy share link": "Copy share link",
  "Copy username": "Copy username",
  "Could not clear watch history.": "Could not clear watch history.",
  "Could not copy comment text.": "Could not copy comment text.",
  "Could not copy image.": "Could not copy image.",
  "Could not copy selected text.": "Could not copy selected text.",
  "Could not copy the link.": "Could not copy the link.",
  "Could not copy to the clipboard.": "Could not copy to the clipboard.",
  "Could not copy. Select and copy the text manually.":
    "Could not copy. Select and copy the text manually.",
  "Could not delete collection.": "Could not delete collection.",
  "Could not delete comment.": "Could not delete comment.",
  "Could not load image.": "Could not load image.",
  "Could not publish the collection.": "Could not publish the collection.",
  "Could not read saved collections safely. Reopen the menu after resolving storage changes.":
    "Could not read saved collections safely. Reopen the menu after resolving storage changes.",
  "Could not read saved collections safely. Resolve pending storage changes and try again.":
    "Could not read saved collections safely. Resolve pending storage changes and try again.",
  "Could not save image.": "Could not save image.",
  "Could not save the change. Check available storage and try again.":
    "Could not save the change. Check available storage and try again.",
  "Could not save the collection deletion. Your local collection was preserved.":
    "Could not save the collection deletion. Your local collection was preserved.",
  "Create another destination first.": "Create another destination first.",
  "Delete {count} downloads": "Delete {count} downloads",
  "Delete collection": "Delete collection",
  "Delete this comment? This cannot be undone.": "Delete this comment? This cannot be undone.",
  "Delete post…": "Delete post…",
  "Delete this post from the group?": "Delete this post from the group?",
  "Deleting…": "Deleting…",
  "Deletion is in progress.": "Deletion is in progress.",
  "Download actions for {title}": "Download actions for {title}",
  "Edit post": "Edit post",
  "Episode actions": "Episode actions",
  "Episode information is unavailable.": "Episode information is unavailable.",
  "Episode information is unavailable. No watched state was changed.":
    "Episode information is unavailable. No watched state was changed.",
  "Episode watched state could not be encoded.": "Episode watched state could not be encoded.",
  "Go to": "Go to",
  "Image copied": "Image copied",
  "Image copying is not supported on this platform.":
    "Image copying is not supported on this platform.",
  "Image copying is unavailable.": "Image copying is unavailable.",
  "Image loading cancelled.": "Image loading cancelled.",
  "Image loading timed out.": "Image loading timed out.",
  "Image saved": "Image saved",
  "Image viewer": "Image viewer",
  "Invalid episode identity.": "Invalid episode identity.",
  Like: "Like",
  "Loading image…": "Loading image…",
  "Local changes could not be fully saved.": "Local changes could not be fully saved.",
  "Local images require the desktop app.": "Local images require the desktop app.",
  "Manga page": "Manga page",
  "Mark {count} episodes up to here": "Mark {count} episodes up to here",
  "Mark episode as unwatched": "Mark episode as unwatched",
  "Mark episode as watched": "Mark episode as watched",
  "Mark released episodes as unwatched": "Mark released episodes as unwatched",
  "Mark released episodes as watched": "Mark released episodes as watched",
  "Move to": "Move to",
  'Moved to "{name}"': 'Moved to "{name}"',
  "My profile": "My profile",
  "Network file URLs are not supported.": "Network file URLs are not supported.",
  "No downloads are currently eligible for this action.":
    "No downloads are currently eligible for this action.",
  "No episodes were selected.": "No episodes were selected.",
  "No released episodes are available. No watched state was changed.":
    "No released episodes are available. No watched state was changed.",
  "Only the original author can publish a saved community collection.":
    "Only the original author can publish a saved community collection.",
  "Only your saved copy is deleted. The original remains available.":
    "Only your saved copy is deleted. The original remains available.",
  "Open author profile": "Open author profile",
  "Open collection": "Open collection",
  "Open episode": "Open episode",
  "Open game page": "Open game page",
  "Open image link externally": "Open image link externally",
  "Open link": "Open link",
  "Open list": "Open list",
  "Open page": "Open page",
  "Open related title": "Open related title",
  "Page {number}": "Page {number}",
  "Page actions": "Page actions",
  "Pause {count} downloads": "Pause {count} downloads",
  "Pin channel": "Pin channel",
  "Play channel": "Play channel",
  "Play from beginning": "Play from beginning",
  "Provider could not identify the requested content.":
    "Provider could not identify the requested content.",
  "Provider did not confirm every requested item.":
    "Provider did not confirm every requested item.",
  "Refresh history": "Refresh history",
  "Remove {count} downloads and delete their saved or partial files? Folders are kept.\n\n{details}":
    "Remove {count} downloads and delete their saved or partial files? Folders are kept.\n\n{details}",
  "Remove {count} PDF print records from Downloads? Harbor did not save these PDF files.":
    "Remove {count} PDF print records from Downloads? Harbor did not save these PDF files.",
  "Remove @{handle} from your friends?": "Remove @{handle} from your friends?",
  "Remove friend…": "Remove friend…",
  'Remove from "{name}"': 'Remove from "{name}"',
  "Remove from downloads": "Remove from downloads",
  "Resume {count} downloads": "Resume {count} downloads",
  "Resume playback": "Resume playback",
  "Retry {count} downloads": "Retry {count} downloads",
  "Save image": "Save image",
  "Save image…": "Save image…",
  "Shared copies on your profile are preserved.": "Shared copies on your profile are preserved.",
  "Sign in and reopen the share dialog.": "Sign in and reopen the share dialog.",
  "Sign in to Harbor to add items to your profile.":
    "Sign in to Harbor to add items to your profile.",
  "Sign in to Harbor to open your profile.": "Sign in to Harbor to open your profile.",
  "Sign in to perform this action.": "Sign in to perform this action.",
  "Simkl did not confirm plan-to-watch status.": "Simkl did not confirm plan-to-watch status.",
  "Simkl disconnected.": "Simkl disconnected.",
  source: "source",
  "Stremio account changed.": "Stremio account changed.",
  "Stremio has not confirmed this change; a failed write may be queued for retry.":
    "Stremio has not confirmed this change; a failed write may be queued for retry.",
  "The account or theme changed. Reopen the comment menu.":
    "The account or theme changed. Reopen the comment menu.",
  "The action could not be completed.": "The action could not be completed.",
  "The active profile changed.": "The active profile changed.",
  "The active profile changed. Open the menu again.":
    "The active profile changed. Open the menu again.",
  "The active profile could not be read.": "The active profile could not be read.",
  "The active profile or account changed. Reopen the comment menu.":
    "The active profile or account changed. Reopen the comment menu.",
  "The active profile or Harbor account changed. Reopen the share dialog.":
    "The active profile or Harbor account changed. Reopen the share dialog.",
  "The active profile or Stremio account changed. Reopen the menu.":
    "The active profile or Stremio account changed. Reopen the menu.",
  "The browser could not copy this image.": "The browser could not copy this image.",
  "The collection was unpublished, but local deletion could not be saved. Your local collection was preserved; retry after resolving storage or concurrent edits.":
    "The collection was unpublished, but local deletion could not be saved. Your local collection was preserved; retry after resolving storage or concurrent edits.",
  "The collection was unpublished, but the local profile or account changed. Your local collection was preserved.":
    "The collection was unpublished, but the local profile or account changed. Your local collection was preserved.",
  "The comment was deleted, but replies could not be refreshed.":
    "The comment was deleted, but replies could not be refreshed.",
  "The comment update could not be confirmed. Refresh its current state.":
    "The comment update could not be confirmed. Refresh its current state.",
  "The collections exceed the publication limit. No collections were published.":
    "The collections exceed the publication limit. No collections were published.",
  "The destination is no longer available.": "The destination is no longer available.",
  "The download finished or failed before this action completed.":
    "The download finished or failed before this action completed.",
  "The download path is not a regular file; folders cannot be deleted here.":
    "The download path is not a regular file; folders cannot be deleted here.",
  "The download path is not a regular file.": "The download path is not a regular file.",
  "The downloaded file is missing or no longer exists.":
    "The downloaded file is missing or no longer exists.",
  "The episode identity is invalid.": "The episode identity is invalid.",
  "The friend request is no longer available.": "The friend request is no longer available.",
  "The Harbor account changed. Reopen the delete confirmation.":
    "The Harbor account changed. Reopen the delete confirmation.",
  "The image content does not match its reported format.":
    "The image content does not match its reported format.",
  "The image is too large (maximum 32 MB).": "The image is too large (maximum 32 MB).",
  "The image is too large to copy. Save the original image instead.":
    "The image is too large to copy. Save the original image instead.",
  "The image response is empty.": "The image response is empty.",
  "The inline image is invalid.": "The inline image is invalid.",
  "The provider did not confirm this change. Any completed changes were kept.":
    "The provider did not confirm this change. Any completed changes were kept.",
  "The provider episode identity is invalid.": "The provider episode identity is invalid.",
  "The provider episode needs a verified title identity.":
    "The provider episode needs a verified title identity.",
  "The provider's current state could not be checked. No changes were made.":
    "The provider's current state could not be checked. No changes were made.",
  "The relationship changed. Open the menu again.":
    "The relationship changed. Open the menu again.",
  "The saved collections exceed the publication limit.":
    "The saved collections exceed the publication limit.",
  "The saved list data could not be read safely.": "The saved list data could not be read safely.",
  "The saved watched state cannot be aligned with this episode list.":
    "The saved watched state cannot be aligned with this episode list.",
  "The saved watched state could not be decoded.": "The saved watched state could not be decoded.",
  "The saved watched state has an invalid anchor.":
    "The saved watched state has an invalid anchor.",
  "The saved watched state is malformed.": "The saved watched state is malformed.",
  "The saved watchlist could not be read.": "The saved watchlist could not be read.",
  "The saved watchlist view could not be updated.":
    "The saved watchlist view could not be updated.",
  "The server accepted the publication change, but local storage could not be updated. Your local collection was preserved; retry after resolving storage or concurrent edits.":
    "The server accepted the publication change, but local storage could not be updated. Your local collection was preserved; retry after resolving storage or concurrent edits.",
  "The server accepted the publication change, but the local profile or account changed. Reopen this collection to reconcile its sharing state.":
    "The server accepted the publication change, but the local profile or account changed. Reopen this collection to reconcile its sharing state.",
  "The server did not save the requested profile items.":
    "The server did not save the requested profile items.",
  "The source did not return an image.": "The source did not return an image.",
  "The source is no longer available.": "The source is no longer available.",
  "The source is not a supported image.": "The source is not a supported image.",
  "The source is not an image.": "The source is not an image.",
  "The update was saved to the previous profile. The active profile changed.":
    "The update was saved to the previous profile. The active profile changed.",
  "The watchlist was not saved.": "The watchlist was not saved.",
  "There are unsaved list changes. Free storage space and try again.":
    "There are unsaved list changes. Free storage space and try again.",
  "This action is already running.": "This action is already running.",
  "This action is no longer available.": "This action is no longer available.",
  "This clears playback progress and watched status for all of “{title}” in Stremio, including every episode. Your watchlist membership and Trakt history are preserved.":
    "This clears playback progress and watched status for all of “{title}” in Stremio, including every episode. Your watchlist membership and Trakt history are preserved.",
  "This collection no longer exists.": "This collection no longer exists.",
  "This comment cannot be deleted.": "This comment cannot be deleted.",
  "This comment is being updated.": "This comment is being updated.",
  "This comment is no longer available.": "This comment is no longer available.",
  "This destination is full.": "This destination is full.",
  "This download has changed. Try again.": "This download has changed. Try again.",
  "This download has no file path.": "This download has no file path.",
  "This download is a book, not a video.": "This download is a book, not a video.",
  "This download is already being deleted.": "This download is already being deleted.",
  "This download is no longer available.": "This download is no longer available.",
  "This download no longer exists.": "This download no longer exists.",
  "This file is shared with another download or is in use by the player.":
    "This file is shared with another download or is in use by the player.",
  "This image could not be decoded.": "This image could not be decoded.",
  "This image has no source.": "This image has no source.",
  "This image source is not supported.": "This image source is not supported.",
  "This item is no longer available.": "This item is no longer available.",
  "This item is no longer in the source.": "This item is no longer in the source.",
  "This item opened a PDF print dialog; Harbor has no saved file to open.":
    "This item opened a PDF print dialog; Harbor has no saved file to open.",
  "This page is already refreshing.": "This page is already refreshing.",
  "This page refresh is no longer available.": "This page refresh is no longer available.",
  "This removes the collection and its title memberships.":
    "This removes the collection and its title memberships.",
  "This title has no Stremio watch history to clear.":
    "This title has no Stremio watch history to clear.",
  "This title is already being updated.": "This title is already being updated.",
  "This title is no longer in Stremio history.": "This title is no longer in Stremio history.",
  "Trakt disconnected.": "Trakt disconnected.",
  Unlike: "Unlike",
  "View author profile": "View author profile",
  "View creator": "View creator",
  "View image": "View image",
  "View page {number}": "View page {number}",
  "View person": "View person",
  "View program details": "View program details",
  "Visible downloads ({visible} of {all})": "Visible downloads ({visible} of {all})",
  "Visible pages": "Visible pages",
  "Watched actions are not available for this content type.":
    "Watched actions are not available for this content type.",
  "You no longer have permission to delete this comment.":
    "You no longer have permission to delete this comment.",
  "Your profile section is full. Remove an item before adding another.":
    "Your profile section is full. Remove an item before adding another.",
  "Your published copy will also be removed from the community.":
    "Your published copy will also be removed from the community.",
};

export default contextActionsFallback;
