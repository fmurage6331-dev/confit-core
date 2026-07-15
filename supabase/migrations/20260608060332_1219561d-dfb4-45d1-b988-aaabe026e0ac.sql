REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_permission(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_access_request() FROM anon, authenticated, PUBLIC;

DROP POLICY IF EXISTS "Public read branding" ON storage.objects;

CREATE POLICY "Admins list branding"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));