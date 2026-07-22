# MOH Reporting: Tagging Architecture

## Overview

The MOH reporting system uses a two-layer tagging architecture to automatically generate indicator codes when encounters are created or updated.

## The Two Layers

### 1. Demographics Tagging — `tag_encounter_demographics()`

**Purpose:** Universal demographic indicators used across ALL MOH tools.

**Current indicators:**
| Code | Criteria |
|------|----------|
| `OPD_UNDER5_M` | Under-5 male |
| `OPD_UNDER5_F` | Under-5 female |
| `OPD_OVER5_M` | Age 5-59 male |
| `OPD_OVER5_F` | Age 5-59 female |
| `OPD_OVER60` | Age 60+ (any gender) |
| `OPD_NEW_M` | New patient (first-ever encounter) male |
| `OPD_NEW_F` | New patient (first-ever encounter) female |
| `OPD_REVISIT_M` | Revisit patient male |
| `OPD_REVISIT_F` | Revisit patient female |

**Why hardcoded?**
- These demographics are standard across MOH 705, 717, and future tools
- Adding new demographic codes only requires editing one function
- Avoids maintaining definition rows for universal concepts
- Ensures consistency — every encounter gets tagged with the correct demographic

**Implementation:**
- Bound to `trg_tag_demographics` trigger on `encounters` table (INSERT + UPDATE)
- Reads `patients.dob_known`, `patients.date_of_birth`, `patients.estimated_age`, `patients.sex`
- Uses `ON CONFLICT (encounter_id, indicator_code) DO NOTHING` for idempotency

### 2. Tool-Specific Tagging — `process_encounter_indicators()`

**Purpose:** Indicators that are specific to individual MOH tools.

**Current indicators:**
| Code | Tool | Criteria Type |
|------|------|---------------|
| `LAB_HIV` | MOH 706 | Lab test (HIV) |
| `LAB_MALARIA` | MOH 706 | Lab test (Malaria) |
| `FP_IMPLANT` | MOH FP | Family planning (implant) |
| `FP_PILLS` | MOH FP | Family planning (pills) |
| `FP_POP` | MOH FP | Progestin Pills |
| `FP_ECP` | MOH FP | Emergency Contraception |
| `FP_INJECTABLE` | MOH FP | Injectable Contraceptives |
| `FP_IUCD` | MOH FP | IUCD |
| `FP_CONDOMS` | MOH FP | Condoms |
| `PHARM_ANTIBIOTIC` | MOH PHARM | Drug class (antibiotic) |

**Supported criteria types:**
- `lab_test` — Checks `encounters.tests` JSONB against `lab_test_catalog`
- `fp_method` — Checks prescriptions joined with `stock_items.category`
- `drug_class` — Checks prescriptions for drug classes
- `age_range` — Not implemented (demographics handled by layer 1)

**Implementation:**
- Bound to trigger `trg_process_moh_indicators` on `encounters` table (INSERT + UPDATE OF tests)
- Loops through `moh_indicator_definitions` table
- Requires corresponding definition row to generate tags

## Decision: Demographics Stay Hardcoded

**Date:** 22 Jul 2026

**Rationale:**
1. Demographics are universal — used by MOH 705, 717, and future tools
2. `process_encounter_indicators()` only implements `lab_test` and `fp_method` criteria; `age_range` would be redundant
3. Easier to maintain — add a new demographic code by editing one function
4. Avoids proliferation of definition rows for concepts that never change

## Adding New MOH Tools

### For demographics:
Edit `tag_encounter_demographics()` in the database.

### For tool-specific indicators:
1. Add item to `lab_test_catalog` (for lab tests) or `stock_items` (for products)
2. Add a row to `moh_indicator_definitions`
3. OR use the UI: When adding a service or stock item, expand "MOH Indicator" section

## Tables

| Table | Purpose |
|-------|---------|
| `encounter_indicator_tags` | Individual tags per encounter |
| `moh_indicator_definitions` | Definition of tool-specific indicators |
| `moh_monthly_aggregates` | Monthly aggregated counts |
| `lab_test_catalog` | Lab test services with categories |
| `stock_items` | Pharmaceutical/products with categories |
| `room_indicator_map` | Room to indicator mappings |

## Refresh Function

Run `SELECT refresh_moh_aggregates('YYYY-MM-DD'::date)` to recompute monthly aggregates from all tags.
