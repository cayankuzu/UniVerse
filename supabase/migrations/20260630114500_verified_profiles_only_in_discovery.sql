create or replace function public.is_profile_email_verified(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = target_id
      and u.email_confirmed_at is not null
  );
$$;

create or replace function public.can_view_profile(target_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
  target_private boolean;
  target_account_type public.account_type;
begin
  viewer_id := auth.uid();

  select p.is_private, p.account_type
  into target_private, target_account_type
  from public.profiles p
  where p.user_id = target_id
    and p.deleted_at is null;

  if target_account_type = 'club'::public.account_type then
    target_private := false;
  end if;

  if target_private is null then
    return false;
  end if;

  if viewer_id = target_id then
    return true;
  end if;

  if not public.is_profile_email_verified(target_id) then
    return false;
  end if;

  if viewer_id is not null and public.is_blocked_pair(viewer_id, target_id) then
    return false;
  end if;

  if viewer_id is null then
    return target_private = false;
  end if;

  if target_private = false then
    return true;
  end if;

  if public.is_accepted_follower(viewer_id, target_id) then
    return true;
  end if;

  if target_account_type = 'club'::public.account_type then
    return exists (
      select 1
      from public.club_memberships cm
      where cm.club_id = target_id
        and cm.member_id = viewer_id
        and cm.status = 'accepted'::public.membership_status
        and cm.deleted_at is null
    );
  end if;

  return exists (
    select 1
    from public.club_memberships cm
    where cm.club_id = viewer_id
      and cm.member_id = target_id
      and cm.status = 'accepted'::public.membership_status
      and cm.deleted_at is null
  );
end;
$$;

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
      join auth.users au
        on au.id = p.user_id
       and au.email_confirmed_at is not null
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

create or replace function public.search_results_projection(
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
  candidate_limit integer := least(greatest(page_limit * 8, 96), 192);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
  oldest_first boolean := lower(trim(coalesce(sort_mode, 'newest'))) = 'oldest';
  emitted_at timestamptz := timezone('utc', now());
begin
  if kind_name = 'events' then
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
      event_candidates as (
        select
          e.id,
          e.created_at
        from public.events e
        join public.profiles club
          on club.user_id = e.club_id
         and club.deleted_at is null
        cross join resolved_viewer rv
        where e.deleted_at is null
          and coalesce(club.is_private, false) = false
          and (rv.uid is null or e.club_id <> rv.uid)
          and not exists (
            select 1
            from accepted_follows af
            where af.following_id = e.club_id
          )
          and (
            normalized_query = '' or
            (
              prefix_tsquery is not null and
              to_tsvector(
                'simple',
                coalesce(e.title, '') || ' ' ||
                coalesce(e.description, '') || ' ' ||
                coalesce(e.location_name, '')
              ) @@ prefix_tsquery
            ) or
            lower(coalesce(e.title, '')) like prefix_pattern or
            lower(coalesce(e.location_name, '')) like prefix_pattern or
            lower(coalesce(club.username, '')) like prefix_pattern or
            lower(coalesce(club.club_name, club.name, '')) like prefix_pattern
          )
          and (category_filter is null or e.category = category_filter)
          and (university_filter is null or club.university = university_filter)
          and (
            fee_filter is null or fee_filter = '' or
            (fee_filter = 'free' and lower(coalesce(e.fee_label, '')) like '%ucretsiz%') or
            (fee_filter = 'paid' and lower(coalesce(e.fee_label, '')) not like '%ucretsiz%')
          )
          and (
            visibility_filter is null or visibility_filter = '' or
            e.visibility::text = visibility_filter
          )
          and (since is null or e.created_at >= since)
          and (
            cursor_timestamp is null
            or (
              not oldest_first
              and (
                e.created_at < cursor_timestamp
                or (e.created_at = cursor_timestamp and e.id::text < coalesce(cursor_identity, ''))
              )
            )
            or (
              oldest_first
              and (
                e.created_at > cursor_timestamp
                or (e.created_at = cursor_timestamp and e.id::text > coalesce(cursor_identity, ''))
              )
            )
          )
        order by
          case when oldest_first then e.created_at end asc nulls last,
          case when not oldest_first then e.created_at end desc nulls last,
          case when oldest_first then e.id::text end asc nulls last,
          case when not oldest_first then e.id::text end desc nulls last
        limit candidate_limit
      ),
      event_album_counts as (
        select
          ap.event_id,
          count(*)::integer as album_count
        from public.album_photos ap
        join event_candidates ec on ec.id = ap.event_id
        where ap.deleted_at is null
          and coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
        group by ap.event_id
      ),
      visible_event_rows as (
        select
          ev.created_at,
          ec.id::text as row_id,
          to_jsonb(ev) || jsonb_build_object(
            'albumCount', coalesce(eac.album_count, 0)
          ) as item_json
        from event_candidates ec
        join lateral public.get_event_view_row(ec.id) ev on true
        left join event_album_counts eac on eac.event_id = ec.id
        where ev.discoverable
          and coalesce(ev.club_is_private, false) = false
      ),
      ordered_rows as (
        select *
        from visible_event_rows r
        order by
          case when oldest_first then r.created_at end asc nulls last,
          case when not oldest_first then r.created_at end desc nulls last,
          case when oldest_first then r.row_id end asc nulls last,
          case when not oldest_first then r.row_id end desc nulls last
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
  elsif kind_name = 'albums' then
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
          and (rv.uid is null or (a.uploader_id <> rv.uid and a.club_id <> rv.uid))
          and not exists (
            select 1
            from accepted_follows af
            where af.following_id in (a.uploader_id, a.club_id)
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
  else
    return public.search_users_projection_query_all(
      viewer_id,
      kind_name,
      query_text,
      category_filter,
      university_filter,
      sort_mode,
      cursor,
      limit_count,
      since
    );
  end if;
end;
$$;

grant execute on function public.is_profile_email_verified(uuid) to authenticated, anon;
