import { getMusicState, subscribeMusic, toggleMusicPlayback } from "./player";
import { createSnippetSessionManager } from "./snippet-session-state";

/** Borrow silence without changing the player queue or position. */
export const beginSnippetSession = createSnippetSessionManager({ getMusicState, subscribeMusic, toggleMusicPlayback });
