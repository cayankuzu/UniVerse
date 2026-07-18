create or replace function private_api.check_profile_identity_availability(
  target_field text,
  target_value text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_field text := lower(trim(coalesce(target_field, '')));
  normalized_value text := lower(trim(coalesce(target_value, '')));
  is_taken boolean := false;
  unavailable_reason text := null;
begin
  if normalized_field not in ('email', 'username') then
    raise exception 'Unsupported identity field: %', normalized_field;
  end if;

  if normalized_value = '' then
    return jsonb_build_object(
      'available',
      false,
      'reason',
      case
        when normalized_field = 'username' then 'Kullanici adi zorunludur'
        else 'E-posta zorunludur'
      end
    );
  end if;

  if normalized_field = 'username' then
    unavailable_reason := 'Bu kullanici adi zaten alinmis';

    select exists(
      select 1
      from public.profiles profile_row
      where lower(profile_row.username::text) = normalized_value
    )
    into is_taken;
  else
    unavailable_reason := 'Bu e-posta adresi zaten kullaniliyor';

    select exists(
      select 1
      from public.profiles profile_row
      where lower(profile_row.email::text) = normalized_value
    )
    into is_taken;
  end if;

  return jsonb_build_object(
    'available',
    not is_taken,
    'reason',
    case when is_taken then unavailable_reason else null end
  );
end;
$$;
revoke all on function private_api.check_profile_identity_availability(text, text) from public;
grant execute on function private_api.check_profile_identity_availability(text, text) to anon;
grant execute on function private_api.check_profile_identity_availability(text, text) to authenticated;
grant execute on function private_api.check_profile_identity_availability(text, text) to service_role;
create or replace function public.check_profile_identity_availability(
  target_field text,
  target_value text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private_api.check_profile_identity_availability(target_field, target_value);
$$;
grant execute on function public.check_profile_identity_availability(text, text) to anon;
grant execute on function public.check_profile_identity_availability(text, text) to authenticated;
grant execute on function public.check_profile_identity_availability(text, text) to service_role;
