begin;

select plan(6);

select ok(to_regclass('public.profiles') is not null, 'profiles table exists');
select ok(to_regclass('public.events') is not null, 'events table exists');
select ok(to_regclass('public.album_photos') is not null, 'album photos table exists');

select ok(
  coalesce((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), false),
  'profiles enforces row-level security'
);
select ok(
  coalesce((select relrowsecurity from pg_class where oid = 'public.events'::regclass), false),
  'events enforces row-level security'
);
select ok(
  coalesce((select relrowsecurity from pg_class where oid = 'public.album_photos'::regclass), false),
  'album photos enforce row-level security'
);

select * from finish();
rollback;
