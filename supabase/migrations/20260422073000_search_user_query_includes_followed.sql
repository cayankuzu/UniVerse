-- Search box profile results should span the viewer's full visible user graph.
-- Discovery still hides followed profiles, but an explicit text search should
-- include both followed and unfollowed users while keeping self/block filters.

create or replace function public.search_users_projection_query_all(
  viewer_id uuid default null,
  kind_name text default 'students',
  query_text text default '',
  category_filter text default null,
  university_filter text default null,
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
  normalized_kind text := case
    when lower(trim(coalesce(kind_name, 'students'))) = 'clubs' then 'clubs'
    else 'students'
  end;
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
      where f.status = 'accepted'
        and f.deleted_at is null
    ),
    ordered_rows as (
      select
        p.created_at,
        p.user_id::text as row_id,
        p.user_id as id,
        p.username,
        coalesce(p.name, p.club_name, p.username) as name,
        p.account_type as "accountType",
        coalesce(p.profile_image_path, '') as image,
        coalesce(p.cover_image_path, '') as "coverImage",
        coalesce(p.university, '') as university,
        p.is_private as "isPrivate",
        p.created_at as "createdAt",
        p.department,
        p.grade_year as year,
        case when array_length(p.categories, 1) > 0 then p.categories[1] else null end as category,
        coalesce(p.categories, '{}'::text[]) as categories,
        coalesce(p.description, p.bio, '') as description,
        coalesce(p.bio, p.description, '') as bio
      from public.profiles p
      cross join resolved_viewer rv
      where p.account_type = case
          when normalized_kind = 'clubs' then 'club'::public.account_type
          else 'student'::public.account_type
        end
        and p.deleted_at is null
        and (rv.uid is null or p.user_id <> rv.uid)
        and (
          normalized_query <> '' or
          not exists (
            select 1
            from accepted_follows af
            where af.following_id = p.user_id
          )
        )
        and (
          normalized_query = '' or
          (
            prefix_tsquery is not null and
            to_tsvector(
              'simple',
              coalesce(p.username, '') || ' ' ||
              coalesce(p.name, '') || ' ' ||
              coalesce(p.club_name, '') || ' ' ||
              coalesce(p.description, '') || ' ' ||
              coalesce(p.bio, '')
            ) @@ prefix_tsquery
          ) or
          lower(coalesce(p.username, '')) like prefix_pattern or
          lower(coalesce(p.name, '')) like prefix_pattern or
          lower(coalesce(p.club_name, '')) like prefix_pattern
        )
        and (category_filter is null or normalized_kind <> 'clubs' or category_filter = any(coalesce(p.categories, '{}'::text[])))
        and (university_filter is null or p.university = university_filter)
        and (since is null or p.last_activity_at >= since)
        and (
          cursor_timestamp is null
          or (
            not oldest_first
            and (
              p.created_at < cursor_timestamp
              or (p.created_at = cursor_timestamp and p.user_id::text < coalesce(cursor_identity, ''))
            )
          )
          or (
            oldest_first
            and (
              p.created_at > cursor_timestamp
              or (p.created_at = cursor_timestamp and p.user_id::text > coalesce(cursor_identity, ''))
            )
          )
        )
      order by
        case when oldest_first then p.created_at end asc nulls last,
        case when not oldest_first then p.created_at end desc nulls last,
        case when oldest_first then p.user_id::text end asc nulls last,
        case when not oldest_first then p.user_id::text end desc nulls last
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
          jsonb_build_object(
            'id', r.id,
            'user_id', r.id,
            'username', r.username,
            'name', r.name,
            'accountType', r."accountType",
            'account_type', r."accountType",
            'image', r.image,
            'coverImage', r."coverImage",
            'university', r.university,
            'isPrivate', r."isPrivate",
            'createdAt', r."createdAt",
            'department', r.department,
            'year', r.year,
            'category', r.category,
            'categories', r.categories,
            'description', r.description,
            'bio', r.bio
          )
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
create or replace function public.search_results_projection_v2(
  viewer_id uuid default null,
  kind_name text default 'events',
  query_text text default '',
  category_filter text default null,
  university_filter text default null,
  fee_filter text default null,
  visibility_filter text default null,
  sort_mode text default 'newest',
  cursor text default null,
  limit_count integer default 20,
  since timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(trim(coalesce(kind_name, 'events'))) = 'events'
      then public.enrich_event_projection_envelope(
        public.search_results_projection(
          viewer_id,
          kind_name,
          query_text,
          category_filter,
          university_filter,
          fee_filter,
          visibility_filter,
          sort_mode,
          cursor,
          limit_count,
          since
        ),
        null
      )
    when lower(trim(coalesce(kind_name, 'events'))) = 'albums'
      then public.search_albums_projection_public_profiles(
        viewer_id,
        query_text,
        sort_mode,
        cursor,
        limit_count,
        since
      )
    when lower(trim(coalesce(kind_name, 'events'))) in ('clubs', 'students')
      and lower(trim(coalesce(query_text, ''))) <> ''
      then public.search_users_projection_query_all(
        viewer_id,
        kind_name,
        query_text,
        category_filter,
        university_filter,
        sort_mode,
        cursor,
        limit_count,
        since
      )
    else public.search_results_projection(
      viewer_id,
      kind_name,
      query_text,
      category_filter,
      university_filter,
      fee_filter,
      visibility_filter,
      sort_mode,
      cursor,
      limit_count,
      since
    )
  end;
$$;
create or replace function public.search_results_projection_v2(
  viewer_id uuid,
  kind_name text,
  query_text text,
  category_filter text,
  university_filter text,
  fee_filter text,
  visibility_filter text,
  sort_mode text,
  cursor text,
  limit_count integer,
  since timestamptz,
  delta_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(trim(coalesce(kind_name, 'events'))) = 'events'
      then public.enrich_event_projection_envelope(
        public.search_results_projection(
          viewer_id,
          kind_name,
          query_text,
          category_filter,
          university_filter,
          fee_filter,
          visibility_filter,
          sort_mode,
          cursor,
          limit_count,
          since,
          delta_token
        ),
        null
      )
    when lower(trim(coalesce(kind_name, 'events'))) = 'albums'
      then public.search_albums_projection_public_profiles(
        coalesce(viewer_id, auth.uid()),
        query_text,
        sort_mode,
        cursor,
        limit_count,
        public.resolve_projection_since(since, delta_token)
      )
    when lower(trim(coalesce(kind_name, 'events'))) in ('clubs', 'students')
      and lower(trim(coalesce(query_text, ''))) <> ''
      then public.search_users_projection_query_all(
        coalesce(viewer_id, auth.uid()),
        kind_name,
        query_text,
        category_filter,
        university_filter,
        sort_mode,
        cursor,
        limit_count,
        public.resolve_projection_since(since, delta_token)
      )
    else public.search_results_projection(
      viewer_id,
      kind_name,
      query_text,
      category_filter,
      university_filter,
      fee_filter,
      visibility_filter,
      sort_mode,
      cursor,
      limit_count,
      since,
      delta_token
    )
  end;
$$;
grant execute on function public.search_users_projection_query_all(uuid, text, text, text, text, text, text, integer, timestamptz) to authenticated;
grant execute on function public.search_results_projection_v2(uuid, text, text, text, text, text, text, text, text, integer, timestamptz) to authenticated;
grant execute on function public.search_results_projection_v2(uuid, text, text, text, text, text, text, text, text, integer, timestamptz, text) to authenticated;
