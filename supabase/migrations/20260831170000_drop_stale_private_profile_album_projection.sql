-- The 2026-06 security-definer rehome left an internal copy of
-- list_profile_visible_albums behind. The public implementation was replaced
-- in 2026-07 and no longer delegates to this private copy. Keeping the stale
-- routine makes DB lint fail because its SELECT predates three counter fields.
-- Drop only the unreferenced duplicate; the public projection contract and
-- grants remain unchanged.
drop function if exists private_api.list_profile_visible_albums(uuid);

