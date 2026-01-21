-- Consolidate Rashida accounts + delete Armon Frey (with dependent row cleanup)

DO $$
DECLARE
  v_keep uuid := '72ec6fca-9225-416c-8207-d963760ab51c';
  v_dupe uuid := '95bcf6b6-24f9-47bf-849b-37494e68d9cb';
  v_armon uuid := '0db52567-89cc-444f-a5e9-a0601c34cca7';
  r record;
BEGIN
  -- Ensure kept account has an authoritative role
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (v_keep, 'agent'::public.app_role, v_keep)
  ON CONFLICT (user_id, role) DO NOTHING;

  /* =========================
     Rashida merge (dupe -> keep)
     ========================= */

  -- coaching_reminder_logs: de-dupe on (agent_id, week_number, year)
  DELETE FROM public.coaching_reminder_logs d
  WHERE d.agent_id = v_dupe
    AND EXISTS (
      SELECT 1
      FROM public.coaching_reminder_logs k
      WHERE k.agent_id = v_keep
        AND k.week_number = d.week_number
        AND k.year = d.year
    );
  UPDATE public.coaching_reminder_logs SET agent_id = v_keep WHERE agent_id = v_dupe;

  -- Other known FKs to profiles(user_id)
  UPDATE public.coaching_sessions SET agent_id = v_keep WHERE agent_id = v_dupe;
  UPDATE public.coaching_sessions SET coach_id = v_keep WHERE coach_id = v_dupe;
  UPDATE public.coaching_submissions SET agent_id = v_keep WHERE agent_id = v_dupe;
  UPDATE public.dtd2_tasks SET agent_id = v_keep WHERE agent_id = v_dupe;
  UPDATE public.email_logs SET agent_id = v_keep WHERE agent_id = v_dupe;
  UPDATE public.events SET created_by = v_keep WHERE created_by = v_dupe;
  UPDATE public.newsletter_campaigns SET created_by = v_keep WHERE created_by = v_dupe;
  UPDATE public.social_media_analytics SET created_by = v_keep WHERE created_by = v_dupe;
  UPDATE public.spheresync_email_logs SET agent_id = v_keep WHERE agent_id = v_dupe;
  UPDATE public.transaction_coordination SET responsible_agent = v_keep WHERE responsible_agent = v_dupe;
  UPDATE public."Leads_Table_Agents_Name" SET assigned_agent_id = v_keep WHERE assigned_agent_id = v_dupe;

  -- Best-effort reassignment for other common user columns
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema
        AND table_name = r.table_name
        AND column_name = 'agent_id'
        AND udt_name = 'uuid'
    ) THEN
      BEGIN
        EXECUTE format('UPDATE %I.%I SET agent_id = $1 WHERE agent_id = $2', r.table_schema, r.table_name)
        USING v_keep, v_dupe;
      EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Skipped agent_id reassignment on %.% due to unique constraint', r.table_schema, r.table_name;
      END;
    END IF;

    IF r.table_name NOT IN ('profiles', 'user_roles') AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema
        AND table_name = r.table_name
        AND column_name = 'user_id'
        AND udt_name = 'uuid'
    ) THEN
      BEGIN
        EXECUTE format('UPDATE %I.%I SET user_id = $1 WHERE user_id = $2', r.table_schema, r.table_name)
        USING v_keep, v_dupe;
      EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Skipped user_id reassignment on %.% due to unique constraint', r.table_schema, r.table_name;
      END;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema
        AND table_name = r.table_name
        AND column_name = 'created_by'
        AND udt_name = 'uuid'
    ) THEN
      BEGIN
        EXECUTE format('UPDATE %I.%I SET created_by = $1 WHERE created_by = $2', r.table_schema, r.table_name)
        USING v_keep, v_dupe;
      EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Skipped created_by reassignment on %.% due to unique constraint', r.table_schema, r.table_name;
      END;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema
        AND table_name = r.table_name
        AND column_name = 'assigned_agent_id'
        AND udt_name = 'uuid'
    ) THEN
      BEGIN
        EXECUTE format('UPDATE %I.%I SET assigned_agent_id = $1 WHERE assigned_agent_id = $2', r.table_schema, r.table_name)
        USING v_keep, v_dupe;
      EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Skipped assigned_agent_id reassignment on %.% due to unique constraint', r.table_schema, r.table_name;
      END;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema
        AND table_name = r.table_name
        AND column_name = 'owner_id'
        AND udt_name = 'uuid'
    ) THEN
      BEGIN
        EXECUTE format('UPDATE %I.%I SET owner_id = $1 WHERE owner_id = $2', r.table_schema, r.table_name)
        USING v_keep, v_dupe;
      EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Skipped owner_id reassignment on %.% due to unique constraint', r.table_schema, r.table_name;
      END;
    END IF;
  END LOOP;

  -- Remove duplicate Rashida profile/roles
  DELETE FROM public.user_roles WHERE user_id = v_dupe;
  DELETE FROM public.profiles WHERE user_id = v_dupe;

  /* =========================
     Armon deletion (delete dependent rows, then auth user)
     ========================= */
  -- Remove dependent rows that block deleting Armon's profile/auth user
  DELETE FROM public.coaching_submissions WHERE agent_id = v_armon;

  -- Finally delete auth users (Rashida dupe + Armon)
  DELETE FROM auth.users WHERE id IN (v_dupe, v_armon);

END $$;
