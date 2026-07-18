create or replace function public.read_client_mutation_receipt(
  operation_name text,
  client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_viewer_id uuid := auth.uid();
  normalized_operation text := nullif(trim(coalesce($1, '')), '');
  normalized_mutation_id text := public.normalize_client_mutation_id($2);
  existing_response jsonb;
begin
  if request_viewer_id is null then
    raise exception 'unauthorized';
  end if;

  if normalized_operation is null or normalized_mutation_id is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(request_viewer_id::text),
    hashtext(normalized_operation || ':' || normalized_mutation_id)
  );

  select r.response
    into existing_response
  from public.client_mutation_receipts r
  where r.viewer_id = request_viewer_id
    and r.operation = normalized_operation
    and r.client_mutation_id = normalized_mutation_id;

  return existing_response;
end;
$$;
create or replace function public.write_client_mutation_receipt(
  operation_name text,
  client_mutation_id text,
  response_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_viewer_id uuid := auth.uid();
  normalized_operation text := nullif(trim(coalesce($1, '')), '');
  normalized_mutation_id text := public.normalize_client_mutation_id($2);
  stored_response jsonb;
begin
  if request_viewer_id is null then
    raise exception 'unauthorized';
  end if;

  if normalized_operation is null or normalized_mutation_id is null then
    return coalesce($3, '{}'::jsonb);
  end if;

  perform pg_advisory_xact_lock(
    hashtext(request_viewer_id::text),
    hashtext(normalized_operation || ':' || normalized_mutation_id)
  );

  insert into public.client_mutation_receipts (
    viewer_id,
    operation,
    client_mutation_id,
    response
  )
  values (
    request_viewer_id,
    normalized_operation,
    normalized_mutation_id,
    coalesce($3, '{}'::jsonb)
  )
  on conflict (viewer_id, operation, client_mutation_id) do nothing;

  select r.response
    into stored_response
  from public.client_mutation_receipts r
  where r.viewer_id = request_viewer_id
    and r.operation = normalized_operation
    and r.client_mutation_id = normalized_mutation_id;

  return coalesce(stored_response, coalesce($3, '{}'::jsonb));
end;
$$;
create or replace function public.set_event_comment_like(
  target_comment_id uuid,
  desired_liked boolean,
  client_mutation_id text default null
)
returns table(liked boolean, likes_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  normalized_client_mutation_id text := nullif(trim(coalesce($3, '')), '');
  request_viewer_id uuid := auth.uid();
  target_event_id uuid;
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  select ec.event_id
  into target_event_id
  from public.event_comments ec
  where ec.id = target_comment_id;

  if target_event_id is null then
    raise exception 'Comment not found';
  end if;

  if not public.can_view_event(target_event_id) then
    raise exception 'Comment is not visible to current user';
  end if;

  if normalized_client_mutation_id is not null then
    existing_response := public.read_client_mutation_receipt(
      'set_event_comment_like',
      normalized_client_mutation_id
    );
    if existing_response is not null then
      liked := coalesce((existing_response ->> 'liked')::boolean, false);
      likes_count := coalesce((existing_response ->> 'likes_count')::bigint, 0);
      return next;
      return;
    end if;
  end if;

  if coalesce(desired_liked, false) then
    insert into public.event_comment_likes (comment_id, user_id)
    values (target_comment_id, request_viewer_id)
    on conflict (comment_id, user_id) do nothing;
  else
    delete from public.event_comment_likes
    where comment_id = target_comment_id
      and user_id = request_viewer_id;
  end if;

  select
    exists (
      select 1
      from public.event_comment_likes ecl
      where ecl.comment_id = target_comment_id
        and ecl.user_id = request_viewer_id
    ),
    count(*)::bigint
  into liked, likes_count
  from public.event_comment_likes
  where comment_id = target_comment_id;

  if normalized_client_mutation_id is not null then
    perform public.write_client_mutation_receipt(
      'set_event_comment_like',
      normalized_client_mutation_id,
      jsonb_build_object(
        'liked', liked,
        'likes_count', likes_count
      )
    );
  end if;

  return next;
end;
$$;
create or replace function public.set_album_comment_like(
  target_comment_id uuid,
  desired_liked boolean,
  client_mutation_id text default null
)
returns table(liked boolean, likes_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  normalized_client_mutation_id text := nullif(trim(coalesce($3, '')), '');
  request_viewer_id uuid := auth.uid();
  target_event_id uuid;
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  select ap.event_id
  into target_event_id
  from public.album_photo_comments apc
  join public.album_photos ap on ap.id = apc.photo_id
  where apc.id = target_comment_id;

  if target_event_id is null then
    raise exception 'Comment not found';
  end if;

  if not public.can_view_event(target_event_id) then
    raise exception 'Comment is not visible to current user';
  end if;

  if normalized_client_mutation_id is not null then
    existing_response := public.read_client_mutation_receipt(
      'set_album_comment_like',
      normalized_client_mutation_id
    );
    if existing_response is not null then
      liked := coalesce((existing_response ->> 'liked')::boolean, false);
      likes_count := coalesce((existing_response ->> 'likes_count')::bigint, 0);
      return next;
      return;
    end if;
  end if;

  if coalesce(desired_liked, false) then
    insert into public.album_photo_comment_likes (comment_id, user_id)
    values (target_comment_id, request_viewer_id)
    on conflict (comment_id, user_id) do nothing;
  else
    delete from public.album_photo_comment_likes
    where comment_id = target_comment_id
      and user_id = request_viewer_id;
  end if;

  select
    exists (
      select 1
      from public.album_photo_comment_likes apcl
      where apcl.comment_id = target_comment_id
        and apcl.user_id = request_viewer_id
    ),
    count(*)::bigint
  into liked, likes_count
  from public.album_photo_comment_likes
  where comment_id = target_comment_id;

  if normalized_client_mutation_id is not null then
    perform public.write_client_mutation_receipt(
      'set_album_comment_like',
      normalized_client_mutation_id,
      jsonb_build_object(
        'liked', liked,
        'likes_count', likes_count
      )
    );
  end if;

  return next;
end;
$$;
