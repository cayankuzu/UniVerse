-- Keep explicit album search broad, but restore discovery behavior so the
-- blank-query Explore surface excludes albums from already-followed users/clubs.

create or replace function public.search_albums_projection_public_profiles(
  viewer_id uuid default null,
  query_text text default '',
  sort_mode text default 'newest',
  cursor text default null,
  limit_count integer default 20,
  since timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_query text := lower(trim(coalesce(query_text, '')));
  prefix_pattern text := lower(trim(coalesce(query_text, ''))) || '%';
  prefix_tsquery tsquery := public.build_prefix_search_tsquery(query_text);
  page_limit integer := least(greatest(limit_count, 1), 12);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
  oldest_first boolean := lower(trim(coalesce(sort_mode, 'newest'))) = 'oldest';
  emitted_at timestamptz := timezone('utc', now());
begin
  return (
    with resolved_viewer as (
      select coalesce(viewer_id, auth.uid()) as uid
    ),
    accepted_follows as (
      select f.following_id
      from public.follows f
      join resolved_viewer rv on rv.uid is not null and f.follower_id = rv.uid
      where f.status = 'accepted'::public.follow_status
        and f.deleted_at is null
    ),
    ordered_rows as (
      select
        a.created_at,
        a.photo_id::text as row_id,
        to_jsonb(a) || jsonb_build_object(
          'show_on_user_profile', coalesce(ap.show_on_user_profile, ap.show_on_profile, false),
          'show_on_club_profile', coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
        ) as item_json
      from public.list_visible_albums('search', null, null) a
      join public.album_photos ap on ap.id = a.photo_id
      cross join resolved_viewer rv
      where ap.deleted_at is null
        and coalesce(a.club_is_private, false) = false
        and (rv.uid is null or a.uploader_id <> rv.uid)
        and (
          normalized_query <> ''
          or not exists (
            select 1
            from accepted_follows af
            where af.following_id in (a.uploader_id, a.club_id)
          )
        )
        and (
          normalized_query = '' or
          (
            prefix_tsquery is not null and
            to_tsvector(
              'simple',
              coalesce(a.title, '') || ' ' ||
              coalesce(a.caption, '') || ' ' ||
              coalesce(a.event_title, '') || ' ' ||
              coalesce(a.uploader_username, '') || ' ' ||
              coalesce(a.club_username, '')
            ) @@ prefix_tsquery
          ) or
          lower(coalesce(a.title, '')) like prefix_pattern or
          lower(coalesce(a.caption, '')) like prefix_pattern or
          lower(coalesce(a.event_title, '')) like prefix_pattern or
          lower(coalesce(a.uploader_username, '')) like prefix_pattern or
          lower(coalesce(a.club_username, '')) like prefix_pattern
        )
        and (since is null or a.created_at >= since)
        and (
          cursor_timestamp is null
          or (
            not oldest_first
            and (
              a.created_at < cursor_timestamp
              or (a.created_at = cursor_timestamp and a.photo_id::text < coalesce(cursor_identity, ''))
            )
          )
          or (
            oldest_first
            and (
              a.created_at > cursor_timestamp
              or (a.created_at = cursor_timestamp and a.photo_id::text > coalesce(cursor_identity, ''))
            )
          )
        )
      order by
        case when oldest_first then a.created_at end asc nulls last,
        case when not oldest_first then a.created_at end desc nulls last,
        case when oldest_first then a.photo_id::text end asc nulls last,
        case when not oldest_first then a.photo_id::text end desc nulls last
      limit page_limit + 1
    ),
    page_rows as (
      select *
      from ordered_rows r
      order by
        case when oldest_first then r.created_at end asc nulls last,
        case when not oldest_first then r.created_at end desc nulls last,
        case when oldest_first then r.row_id end asc nulls last,
        case when not oldest_first then r.row_id end desc nulls last
      limit page_limit
    ),
    overflow_row as (
      select *
      from ordered_rows r
      order by
        case when oldest_first then r.created_at end asc nulls last,
        case when not oldest_first then r.created_at end desc nulls last,
        case when oldest_first then r.row_id end asc nulls last,
        case when not oldest_first then r.row_id end desc nulls last
      offset page_limit
      limit 1
    )
    select public.build_projection_envelope(
      items := coalesce(
        jsonb_agg(
          r.item_json
          order by
            case when oldest_first then r.created_at end asc nulls last,
            case when not oldest_first then r.created_at end desc nulls last,
            case when oldest_first then r.row_id end asc nulls last,
            case when not oldest_first then r.row_id end desc nulls last
        ),
        '[]'::jsonb
      ),
      next_cursor := (
        select case
          when o.row_id is null then null
          else to_char(timezone('utc', o.created_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' || o.row_id
        end
        from overflow_row o
      ),
      server_time := emitted_at,
      delta_token := emitted_at
    )
    from page_rows r
  );
end;
$$;

grant execute on function public.search_albums_projection_public_profiles(uuid, text, text, text, integer, timestamptz) to authenticated;
