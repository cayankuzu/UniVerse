create or replace function public.create_event_with_patch(
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location_name text,
  p_address text,
  p_event_type text,
  p_category text,
  p_categories text[],
  p_fee_label text,
  p_access_label text,
  p_capacity integer,
  p_target_audience text,
  p_level text,
  p_materials text,
  p_cover_image_path text,
  p_visibility public.event_visibility,
  client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  request_viewer_id uuid := auth.uid();
  created_event public.events%rowtype;
  normalized_mutation_id text := public.normalize_client_mutation_id($18);
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  existing_response := public.read_client_mutation_receipt(
    'create_event_with_patch',
    normalized_mutation_id
  );
  if existing_response is not null then
    return existing_response;
  end if;

  insert into public.events (
    club_id,
    title,
    description,
    starts_at,
    ends_at,
    location_name,
    address,
    event_type,
    category,
    categories,
    fee_label,
    access_label,
    capacity,
    target_audience,
    level,
    materials,
    visibility,
    cover_image_path
  )
  values (
    request_viewer_id,
    trim(coalesce(p_title, '')),
    trim(coalesce(p_description, '')),
    p_starts_at,
    p_ends_at,
    trim(coalesce(p_location_name, '')),
    trim(coalesce(p_address, '')),
    nullif(trim(coalesce(p_event_type, '')), ''),
    trim(coalesce(p_category, '')),
    coalesce(p_categories, '{}'::text[]),
    trim(coalesce(p_fee_label, '')),
    trim(coalesce(p_access_label, '')),
    p_capacity,
    nullif(trim(coalesce(p_target_audience, '')), ''),
    nullif(trim(coalesce(p_level, '')), ''),
    nullif(trim(coalesce(p_materials, '')), ''),
    coalesce(p_visibility, 'public'::public.event_visibility),
    nullif(trim(coalesce(p_cover_image_path, '')), '')
  )
  returning * into created_event;

  return public.write_client_mutation_receipt(
    'create_event_with_patch',
    normalized_mutation_id,
    to_jsonb(created_event)
  );
end;
$$;
grant execute on function public.create_event_with_patch(
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text[],
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  public.event_visibility,
  text
) to authenticated;
