-- ============================================================
-- Migracion: Admin users + documentos KYC
-- Fecha: 2026-06-25
-- ============================================================

alter table if exists kyc_verifications
  add column if not exists id_document_path text,
  add column if not exists id_document_uploaded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'kyc docs upload own'
  ) THEN
    CREATE POLICY "kyc docs upload own"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'kyc-documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'kyc docs read own'
  ) THEN
    CREATE POLICY "kyc docs read own"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'kyc-documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'kyc docs delete own'
  ) THEN
    CREATE POLICY "kyc docs delete own"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'kyc-documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

create or replace function submit_kyc_document(
  p_document_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_document_path is null or btrim(p_document_path) = '' then
    raise exception 'Documento invalido';
  end if;

  insert into kyc_verifications (
    user_id,
    status,
    id_document_path,
    id_document_uploaded_at,
    rejection_reason,
    last_error
  )
  values (
    auth.uid(),
    'submitted',
    p_document_path,
    now(),
    null,
    null
  )
  on conflict (user_id)
  do update set
    status = 'submitted',
    id_document_path = excluded.id_document_path,
    id_document_uploaded_at = now(),
    rejection_reason = null,
    last_error = null,
    updated_at = now();
end;
$$;

revoke all on function submit_kyc_document(text) from public;
grant execute on function submit_kyc_document(text) to authenticated;
