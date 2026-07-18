-- Tek bir kullanıcıyı veritabanından, ilişkili uygulama verilerinden ve auth.users'tan siler.
-- Kullanım:
-- 1) target_user_id alanını doldurun.
-- 2) Kullanıcının storage objeleri varsa service_role_key alanına SB_SECRET_KEY veya SUPABASE_SERVICE_ROLE_KEY yazın.
-- 3) Supabase SQL Editor'de çalıştırın.
--
-- Önemli:
-- - Bu script, veritabanında daha önce eklenmiş public.admin_delete_user_by_id(...)
--   fonksiyonunu çağırır.
-- - Kulüp hesabına bağlı etkinliklerde başka kullanıcıların albüm yükleri varsa,
--   veri kaybını önlemek için fonksiyon işlemi bilinçli olarak durdurur.

do $$
declare
  target_user_id uuid := '00000000-0000-0000-0000-000000000000';
  service_role_key text := '';
  storage_api_url text := 'https://kfvdbfoufybltybsxlhh.supabase.co';
  primary_media_bucket_id text := 'make-e3557d40-media';
  delete_result jsonb;
begin
  if target_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'target_user_id alanini gercek kullanici UUID degeri ile guncelleyin.';
  end if;

  delete_result := public.admin_delete_user_by_id(
    target_user_id,
    nullif(service_role_key, ''),
    storage_api_url,
    primary_media_bucket_id
  );

  raise notice 'delete_result=%', delete_result;
end $$;
