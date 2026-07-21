-- New album cards may contain at most six mixed media items.
-- Existing cards with more media remain readable and editable while their
-- media paths stay unchanged.

create or replace function public.enforce_album_media_count()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  normalized_media_count integer;
begin
  if tg_op = 'UPDATE'
    and new.storage_path is not distinct from old.storage_path
    and new.media_paths is not distinct from old.media_paths then
    return new;
  end if;

  select count(*)
  into normalized_media_count
  from unnest(coalesce(new.media_paths, array[new.storage_path])) as media_path
  where nullif(trim(coalesce(media_path, '')), '') is not null;

  if normalized_media_count > 6 then
    raise exception 'Tek bir album kartinda en fazla 6 medya olabilir.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_album_media_count() from public;

drop trigger if exists album_photos_enforce_media_count on public.album_photos;
create trigger album_photos_enforce_media_count
before insert or update of storage_path, media_paths on public.album_photos
for each row execute function public.enforce_album_media_count();

comment on trigger album_photos_enforce_media_count on public.album_photos is
  'Limits new or media-edited album cards to six mixed image/video items.';
