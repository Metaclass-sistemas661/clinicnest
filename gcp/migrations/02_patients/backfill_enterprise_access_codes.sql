-- Backfill: regenerate access codes for existing patients that still have PAC- format
-- Uses the same enterprise algorithm as generate_client_access_code() trigger

DO $$
DECLARE
  v_rec RECORD;
  v_code TEXT;
  v_exists BOOLEAN;
  v_alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_base INT := 30;
  v_payload TEXT;
  v_check_char TEXT;
  v_sum INT;
  v_factor INT;
  v_i INT;
  v_char_idx INT;
  v_addend INT;
  v_rand BYTEA;
BEGIN
  FOR v_rec IN SELECT id FROM public.patients WHERE access_code NOT LIKE 'CLN-%' OR access_code IS NULL
  LOOP
    LOOP
      v_rand := gen_random_bytes(8);
      v_payload := '';
      FOR v_i IN 0..7 LOOP
        v_char_idx := get_byte(v_rand, v_i) % v_base;
        v_payload := v_payload || substr(v_alphabet, v_char_idx + 1, 1);
      END LOOP;
      v_sum := 0;
      v_factor := 2;
      FOR v_i IN REVERSE 8..1 LOOP
        v_char_idx := position(substr(v_payload, v_i, 1) IN v_alphabet) - 1;
        v_addend := v_factor * v_char_idx;
        v_factor := CASE WHEN v_factor = 2 THEN 1 ELSE 2 END;
        v_addend := (v_addend / v_base) + (v_addend % v_base);
        v_sum := v_sum + v_addend;
      END LOOP;
      v_check_char := substr(v_alphabet, (v_base - (v_sum % v_base)) % v_base + 1, 1);
      v_code := 'CLN-' || v_payload || v_check_char;
      SELECT EXISTS(SELECT 1 FROM public.patients WHERE access_code = v_code) INTO v_exists;
      IF NOT v_exists THEN EXIT; END IF;
    END LOOP;
    UPDATE public.patients SET access_code = v_code WHERE id = v_rec.id;
    RAISE NOTICE 'Updated patient % → %', v_rec.id, v_code;
  END LOOP;
END
$$;

SELECT name, access_code FROM public.patients ORDER BY created_at;
