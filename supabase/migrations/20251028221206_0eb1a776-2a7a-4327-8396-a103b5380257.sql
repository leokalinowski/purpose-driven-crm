-- Create RPC function to encrypt social media tokens
CREATE OR REPLACE FUNCTION public.encrypt_social_token(
  p_access_token text,
  p_refresh_token text,
  p_encryption_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'encrypted_access_token', pgp_sym_encrypt(p_access_token, p_encryption_key),
    'encrypted_refresh_token', 
      CASE 
        WHEN p_refresh_token IS NOT NULL THEN pgp_sym_encrypt(p_refresh_token, p_encryption_key)
        ELSE NULL
      END
  );
END;
$$;

-- Create RPC function to decrypt social media tokens (for edge functions)
CREATE OR REPLACE FUNCTION public.decrypt_social_token(
  p_agent_id uuid,
  p_platform text,
  p_encryption_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account record;
BEGIN
  SELECT * INTO v_account
  FROM public.social_accounts
  WHERE agent_id = p_agent_id AND platform = p_platform
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No account found');
  END IF;
  
  RETURN jsonb_build_object(
    'access_token', pgp_sym_decrypt(v_account.access_token_encrypted, p_encryption_key),
    'refresh_token', 
      CASE 
        WHEN v_account.refresh_token_encrypted IS NOT NULL 
        THEN pgp_sym_decrypt(v_account.refresh_token_encrypted, p_encryption_key)
        ELSE NULL
      END,
    'account_id', v_account.account_id,
    'account_name', v_account.account_name,
    'expires_at', v_account.expires_at
  );
END;
$$;