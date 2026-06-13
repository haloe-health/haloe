-- schema_v2.sql — additive columns for the custom multi-step intake form (Step 2).
--
-- SQLite supports only one `ALTER TABLE ... ADD COLUMN` per statement and has no
-- "ADD COLUMN IF NOT EXISTS", so this file is meant to be applied exactly once on
-- a table that does not yet have these columns. All statements are purely additive
-- (no data is dropped or rewritten).
--
-- Columns whose answer already has a home in the v1 schema are NOT re-added here;
-- they are mapped in functions/intake-submit.js instead:
--   Q12 -> medical_conditions   Q14 -> current_medications   Q16 -> allergies
--   Q19 -> is_pregnant          Q21 -> takes_blood_thinners   Q22 -> bleeding_disorder
--   Q24 -> chemo_or_radiotherapy Q25 -> has_anaemia           Q26 -> infectious_condition
--   Q27 -> recent_surgery       Q17 -> had_hijama_before      Q8/Q9 -> emergency_contact_*
--   Q10 -> gp_name              Q33 -> consent_accurate_info  Q34 -> consent_complementary
--   Q35 -> consent_treatment    Q37 -> consent_data_storage   Q39 -> signature_name

ALTER TABLE intake_forms ADD COLUMN age_confirmed TEXT;            -- Q3  18-or-over (Yes/No)
ALTER TABLE intake_forms ADD COLUMN package TEXT;                  -- Q7  package/treatment booked
ALTER TABLE intake_forms ADD COLUMN area_postcode TEXT;            -- Q6  area / postcode (mobile bookings)
ALTER TABLE intake_forms ADD COLUMN has_conditions TEXT;          -- Q11 ongoing conditions (Yes/No flag; detail -> medical_conditions)
ALTER TABLE intake_forms ADD COLUMN takes_medication TEXT;        -- Q13 medication/supplements (Yes/No flag; detail -> current_medications)
ALTER TABLE intake_forms ADD COLUMN has_allergies TEXT;           -- Q15 allergies (Yes/No flag; detail -> allergies)
ALTER TABLE intake_forms ADD COLUMN main_concern TEXT;            -- Q18 main reason for coming
ALTER TABLE intake_forms ADD COLUMN breastfeeding TEXT;           -- Q20 currently breastfeeding (Yes/No)
ALTER TABLE intake_forms ADD COLUMN diabetes_status TEXT;         -- Q23 diabetes (3-option)
ALTER TABLE intake_forms ADD COLUMN blood_pressure TEXT;          -- Q28 high/low blood pressure (3-option)
ALTER TABLE intake_forms ADD COLUMN skin_condition TEXT;          -- Q29 skin condition in area (Yes/No)
ALTER TABLE intake_forms ADD COLUMN pacemaker_epilepsy TEXT;      -- Q30 pacemaker/epilepsy/other (Yes/No)
ALTER TABLE intake_forms ADD COLUMN safety_notes TEXT;            -- Q31 free-text safety notes
ALTER TABLE intake_forms ADD COLUMN before_after_ack INTEGER;     -- Q32 before/after confirmations (all ticked -> 1)
ALTER TABLE intake_forms ADD COLUMN photo_consent TEXT;           -- Q38 anonymised photo consent (3-option, optional)
ALTER TABLE intake_forms ADD COLUMN signature_date TEXT;          -- Q40 today's date
ALTER TABLE intake_forms ADD COLUMN consent_notify_changes INTEGER; -- Q36 will notify of health changes (-> 1)
