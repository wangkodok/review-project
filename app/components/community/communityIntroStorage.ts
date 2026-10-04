const COMMUNITY_INTRO_STORAGE_KEY = "sseullae-community-intro-seen-v1";
const COMMUNITY_INTRO_STORAGE_VALUE = "true";

type CommunityIntroStorage = Pick<Storage, "getItem" | "setItem">;

export function hasSeenCommunityIntro(storage: CommunityIntroStorage) {
  try {
    return storage.getItem(COMMUNITY_INTRO_STORAGE_KEY) === COMMUNITY_INTRO_STORAGE_VALUE;
  } catch {
    return false;
  }
}

export function markCommunityIntroSeen(storage: CommunityIntroStorage) {
  try {
    storage.setItem(COMMUNITY_INTRO_STORAGE_KEY, COMMUNITY_INTRO_STORAGE_VALUE);
  } catch {
    // The current visit can still dismiss the dialog when storage is unavailable.
  }
}
