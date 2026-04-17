-- Enterprise access code generator with Luhn mod 30 check digit
-- Format: CLN-XXXXXXXXX (8 random chars + 1 check digit from safe alphabet)
-- Safe charset: ABCDEFGHJKMNPQRSTUVWXYZ23456789 (30 chars, no ambiguous O/0/I/1/L)
-- Entropy: 30^8 ≈ 656 billion combinations

CREATE OR REPLACE FUNCTION public.generate_client_access_code()
  RETURNS trigger
  LANGUAGE plpgsql
AS $function$
DECLARE
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
  -- Skip if already set (e.g. manual override or migration)
  IF NEW.access_code IS NOT NULL AND NEW.access_code <> '' THEN
    RETURN NEW;
  END IF;

  LOOP
    -- Generate 8 random chars from safe alphabet
    v_rand := gen_random_bytes(8);
    v_payload := '';
    FOR v_i IN 0..7 LOOP
      v_char_idx := get_byte(v_rand, v_i) % v_base;
      v_payload := v_payload || substr(v_alphabet, v_char_idx + 1, 1);
    END LOOP;

    -- Luhn mod 30 check digit
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

    -- Ensure uniqueness
    SELECT EXISTS(SELECT 1 FROM public.patients WHERE access_code = v_code) INTO v_exists;
    IF NOT v_exists THEN
      NEW.access_code := v_code;
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;