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
  on conflict on constraint client_mutation_receipts_pkey do nothing;

  select r.response
    into stored_response
  from public.client_mutation_receipts r
  where r.viewer_id = request_viewer_id
    and r.operation = normalized_operation
    and r.client_mutation_id = normalized_mutation_id;

  return coalesce(stored_response, coalesce($3, '{}'::jsonb));
end;
$$;
create or replace function public.create_album_photo_with_patch(
  target_event_id uuid,
  target_storage_path text,
  target_media_paths text[] default null,
  target_caption text default null,
  target_title text default null,
  target_show_on_profile boolean default false,
  target_show_on_user_profile boolean default false,
  target_show_on_club_profile boolean default false,
  client_mutation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  request_viewer_id uuid := auth.uid();
  created_photo public.album_photos%rowtype;
  normalized_media_paths text[];
  normalized_storage_path text;
  normalized_mutation_id text := public.normalize_client_mutation_id($9);
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  existing_response := public.read_client_mutation_receipt(
    'create_album_photo_with_patch',
    normalized_mutation_id
  );
  if existing_response is not null then
    return existing_response;
  end if;

  select coalesce(
    array_agg(item) filter (where item is not null and trim(item) <> ''),
    '{}'::text[]
  )
  into normalized_media_paths
  from unnest(coalesce(target_media_paths, array[target_storage_path])) as item;

  normalized_storage_path := coalesce(
    nullif(trim(coalesce(target_storage_path, '')), ''),
    normalized_media_paths[1]
  );

  if normalized_storage_path is null then
    raise exception 'Fotograf secilmedi';
  end if;

  if coalesce(array_length(normalized_media_paths, 1), 0) = 0 then
    normalized_media_paths := array[normalized_storage_path];
  end if;

  insert into public.album_photos (
    event_id,
    user_id,
    storage_path,
    media_paths,
    caption,
    title,
    show_on_profile,
    show_on_user_profile,
    show_on_club_profile
  )
  values (
    target_event_id,
    request_viewer_id,
    normalized_storage_path,
    normalized_media_paths,
    trim(coalesce(target_caption, '')),
    nullif(trim(coalesce(target_title, '')), ''),
    coalesce(target_show_on_profile, false),
    coalesce(target_show_on_user_profile, false),
    coalesce(target_show_on_club_profile, false)
  )
  returning * into created_photo;

  return public.write_client_mutation_receipt(
    'create_album_photo_with_patch',
    normalized_mutation_id,
    to_jsonb(created_photo)
  );
end;
$$;
grant execute on function public.write_client_mutation_receipt(text, text, jsonb) to authenticated;
grant execute on function public.create_album_photo_with_patch(
  uuid,
  text,
  text[],
  text,
  text,
  boolean,
  boolean,
  boolean,
  text
) to authenticated;
