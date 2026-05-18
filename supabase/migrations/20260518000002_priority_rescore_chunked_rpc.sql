-- ============================================================
-- Chunk the rescore RPC at 100 contact IDs per pg_net invocation.
--
-- The edge function does `.in('id', contactIds)` — at >~200 UUIDs the
-- PostgREST URL exceeds 8 KB and the query 500s. The earlier 200-row
-- cap on this RPC was implicitly protecting us. Once that cap was lifted
-- in 20260518000001 (Grok removed → no per-row cost → no need to cap),
-- a 3,380-row payload broke the function on the first cron tick.
--
-- Fix: chunk inside the RPC. Each batch of 100 IDs becomes its own
-- pg_net.http_post — small URLs, parallel execution via Supabase's
-- pg_net worker pool. Returns the LAST request_id; callers mostly care
-- that *something* was queued, not which specific batch.
-- ============================================================

CREATE OR REPLACE FUNCTION public.invoke_priority_rescore(
  where_clause text,
  row_limit integer DEFAULT 10000
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'net'
AS $function$
DECLARE
  v_all_ids UUID[];
  v_batch UUID[];
  v_request_id BIGINT;
  v_last_request_id BIGINT;
  v_sql TEXT;
  v_offset INT;
  v_batch_size CONSTANT INT := 100;
  v_total INT;
BEGIN
  -- 1. Pick the eligible IDs once.
  v_sql := format(
    'SELECT ARRAY(SELECT id FROM public.contacts WHERE %s LIMIT %s)',
    where_clause, row_limit
  );
  EXECUTE v_sql INTO v_all_ids;

  v_total := COALESCE(array_length(v_all_ids, 1), 0);
  IF v_total = 0 THEN
    RAISE NOTICE 'invoke_priority_rescore: no eligible contacts for clause %', where_clause;
    RETURN NULL;
  END IF;

  -- 2. Fire one http_post per batch. pg_net is async — the function
  --    queues all of them and returns immediately. Returns the LAST
  --    request_id since callers mostly want "did anything get queued".
  v_offset := 1;
  WHILE v_offset <= v_total LOOP
    v_batch := v_all_ids[v_offset : LEAST(v_offset + v_batch_size - 1, v_total)];

    SELECT net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/compute-priority-scores',
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Job', 'true'),
      body := jsonb_build_object('contact_ids', to_jsonb(v_batch)),
      timeout_milliseconds := 120000
    ) INTO v_request_id;

    v_last_request_id := v_request_id;
    v_offset := v_offset + v_batch_size;
  END LOOP;

  RAISE NOTICE
    'invoke_priority_rescore fired: total=%, batches=%, last_request_id=%',
    v_total, CEIL(v_total::numeric / v_batch_size), v_last_request_id;
  RETURN v_last_request_id;
END;
$function$;

COMMENT ON FUNCTION public.invoke_priority_rescore(text, integer) IS
  'Cron + event-driven rescore helper. Splits eligible contact IDs into 100-row '
  'batches and fires one async pg_net.http_post per batch into '
  'compute-priority-scores. Returns the last request_id (others run in parallel '
  'via Supabase pg_net workers). Chunking added 2026-05-18 to fix URL-length '
  'overflow when the per-run cap was raised from 200 to 10000.';
