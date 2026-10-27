# AgriMama AI — Maize and Sweet Potato Dataset Package

## Files
- `maize_varieties_kephis_2022.csv`: 68 unique maize variety records transcribed from the 2022 National Crop Variety List, mainly printed pages 42–51.
- `sweetpotato_varieties_kephis_2022.csv`: 32 sweet-potato variety records transcribed from printed pages 11–18.
- `source_register_and_attribution.csv`: source organisations, links, coverage and reuse notes.
- `maize_knowledge_kalro_restricted_review_only.csv`: supplementary maize knowledge extracted from KALRO material. **Do not redistribute or ingest into a production database until KALRO's written permission is obtained.**
- `sweetpotato_knowledge_cip_cc_by_4.csv`: supplementary records from CIP brochure. Attribute the International Potato Center and preserve CC BY 4.0 notice; check third-party exclusions.

## Primary maize source
**National Crop Variety List - Kenya**, January 2022 edition.
- Publisher/source: KEPHIS
- Link: https://kephis.org/images/pdf-files/UPDATED_2022_JANUARY_NATIONAL_VARIETY_LIST.pdf
- Printed pages covered in this expanded extraction: 42–51.
- These 68 entries are a **larger working subset, not the complete national maize list**.

## Newer reference identified
KEPHIS also publishes a 2025 edition: https://www.kephis.go.ke/sites/default/files/2025-02/NATIONAL%20CROP%20VARIETY%20LIST-%202025%20EDITION.pdf
The searchable extract confirms the same first 13 varieties (including H6212), but the full PDF could not be extracted in this pass. The 2022 data below has **not** been relabelled as 2025 data.

## Important limitations
1. The maize dataset has been expanded to 68 unique codes, but it is not a complete national list.
2. Some table rows have line-wrapping/OCR ambiguities. See `data_quality_notes`; verify before farmer-facing use.
3. Altitude, maturity and yield values are reproduced from the source; they are not guarantees or a recommendation for any particular farm.
4. Have a Kenyan agricultural extension specialist validate crop recommendations.
5. Check source permissions/licences before redistribution or production AI ingestion.

## Suggested attribution
“Variety information transcribed from *National Crop Variety List - Kenya*, January 2022 edition, maize list printed pp. 42–51 and sweet potato list printed pp. 11–18. Publisher: Kenya Plant Health Inspectorate Service (KEPHIS). Variety entries identify their respective owners, licensees and maintainers. Structured for AgriMama AI; check source values against the original document before operational use.”

## Supplementary source terms
- KALRO maize publication: the source states all rights reserved and requires prior written permission for reproducing/storing content in databases. Review-only until permission is obtained.
- CIP brochure: source indicates CC BY 4.0; attribute CIP and retain licence notices.

## Dataset 1 — Maize crop growth stages and management (draft)
File: `maize_growth_stages_management_draft.csv`
This file contains 15 draft records with source links, stage context, safe next-action templates, reuse status and validation notes. It intentionally flags source discrepancies (e.g., planting depth and top-dressing stage) instead of silently resolving them.

**Important:** This is a research and expert-review draft, not a validated recommendation engine. Several KALRO sources carry copyright/database-use restrictions or require permission review. Do not redistribute protected KALRO-derived content or ingest it into production until the applicable permission is confirmed. KEPHIS trial-manual instructions are identified as trial-specific and should not automatically be treated as farmer-production recommendations.


## Dataset 2: Maize pest and disease identification (draft)
- File: `maize_pest_disease_identification_draft.csv`; workbook sheet: `Maize_Pest_Disease_Draft`.
- Contains 15 structured draft records covering fall armyworm, selected pests and diseases, and general scouting.
- Sources include KALRO maize crop protection, KALRO fall armyworm identification guidance, and the KALRO KCEP maize production/extension manual.
- This is a research and expert-review draft, not approved farmer-facing advice. Symptom overlap is common; do not treat records as definitive diagnosis.
- No pesticide product/rate instructions are included. Chemical controls require current local expert advice and compliance with approved product labels.
- Review source permissions and attribution requirements before redistributing source-derived content or loading it into a production database.


## Dataset 3: Weather conditions and crop-risk interpretation (draft)
- File: `maize_weather_crop_risk_interpretation_draft.csv`; workbook sheet: `Weather_Crop_Risk_Draft`.
- Contains 12 draft records connecting rainfall, temperature, humidity, wind, data quality and maize crop stage to conservative follow-up checks.
- Main references: FAO crop water needs and crop growth stages pages (URLs recorded in each row).
- This is not a calibrated forecast or approved agronomic advisory. No universal thresholds or irrigation amounts are hardcoded.
- Missing sensor values must remain unknown, not be treated as zero. Station readings may not represent the farmer's exact field.
- Validate thresholds and proposed combined-signal rules with local agronomists and field observations before production use.
