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
  normalized_total_count integer := 0;
  normalized_video_count integer := 0;
  owner_club_id uuid;
  participant_event_id uuid;
  own_album_count integer := 0;
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  existing_response := public.read_client_mutation_receipt('create_album_photo_with_patch', client_mutation_id);
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

  normalized_total_count := coalesce(array_length(normalized_media_paths, 1), 0);
  if normalized_total_count > 9 then
    raise exception 'Tek bir album kartinda en fazla 9 medya olabilir.';
  end if;

  select count(*)
  into normalized_video_count
  from unnest(normalized_media_paths) as media_path
  where lower(trim(coalesce(media_path, ''))) ~ '\.(mp4|mov|m4v|webm|3gp|avi|mkv)(\?|#|$)';

  if normalized_video_count > 3 then
    raise exception 'Tek bir album kartinda en fazla 3 video olabilir.';
  end if;

  select e.club_id
  into owner_club_id
  from public.events e
  where e.id = target_event_id
    and e.deleted_at is null;

  if owner_club_id is null then
    raise exception 'Etkinlik bulunamadi.';
  end if;

  if owner_club_id <> request_viewer_id then
    select ea.event_id
    into participant_event_id
    from public.event_attendees ea
    where ea.event_id = target_event_id
      and ea.user_id = request_viewer_id
    limit 1;

    if participant_event_id is null then
      raise exception 'Bu albume sadece etkinlik sahibi kulup ve katilimcilar medya yukleyebilir.';
    end if;
  end if;

  select count(*)
  into own_album_count
  from public.album_photos ap
  where ap.event_id = target_event_id
    and ap.user_id = request_viewer_id
    and ap.deleted_at is null;

  if own_album_count >= 3 then
    raise exception 'Her kullanici bu etkinlige en fazla 3 album karti ekleyebilir.';
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
    client_mutation_id,
    to_jsonb(created_photo)
  );
end;
$$;

grant execute on function public.create_album_photo_with_patch(
  uuid, text, text[], text, text, boolean, boolean, boolean, text
) to authenticated;
