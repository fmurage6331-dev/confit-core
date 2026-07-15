## Goal

Expand LabTrack with operations modules (machine maintenance, service & calibration, deliveries, stock take), a quarterly report matching your Excel format, and lock down account creation so only you (admin) can create users and grant access.

## 1. Admin-only account creation

- Remove the public "Request access" signup flow. The login page becomes sign-in only.
- New page: **Admin → Users**. You can:
  - Create a new user (email + temporary password) — they're created already-confirmed but with **no role**, so they cannot see any data.
  - Grant `staff` or `admin` role.
  - Revoke access (remove role).
  - Reset a user's password.
- Existing approval queue stays available for any pending requests, but new self-signup is disabled.
- Implemented via a server function using the admin (service-role) Supabase client, protected by `requireSupabaseAuth` + admin check.

## 2. Machine maintenance & calibration

New table `machines` (name, model, serial number, location, status, notes).

New table `machine_logs` with a `log_type` field:
- `maintenance` — routine maintenance entry
- `service` — repair/service visit
- `calibration` — calibration record (with next-due date)

Each log captures: machine, date, performed_by, description, parts/cost, next_due_date (for calibration), attachments-free for now.

Pages:
- `/machines` — list machines, add/edit
- `/machines/$id` — machine detail with full log history grouped by type, "Add log" button
- Dashboard widget: upcoming calibrations due in next 30 days

## 3. Deliveries

New table `deliveries` (date, supplier, item, quantity, unit, batch_number, expiry_date, received_by, invoice_number, notes).

Page `/deliveries` — table with filters (date range, supplier), add/edit/delete.

Each delivery automatically creates a stock movement (+quantity).

## 4. Stock take

New table `stock_items` (name, category, unit, current_quantity, reorder_level).
New table `stock_movements` (item, change, reason: `delivery`/`usage`/`adjustment`/`stock_take`, date, user, notes).

Pages:
- `/stock` — current stock levels, low-stock highlights
- `/stock/take` — stock-take form: enter counted quantity for each item, app records the adjustment movement with the difference

## 5. Quarterly report (matches your Excel)

Page `/reports` with year + quarter picker. Generates the same layout as your sheet:

- Per-month: Total Tests, Total Positives, Medical Camp Tests
- Quarterly summary totals
- Funds Utilization table (Students / Staff / External) per month + quarter totals

To support this, `lab_tests` gets two new optional fields:
- `is_positive` (boolean)
- `is_medical_camp` (boolean)

And a new table `fund_utilizations` (date, category: students/staff/external, amount, notes).

Export: "Download as Excel" button produces an .xlsx that mirrors your January–March layout.

## 6. Navigation

App shell sidebar updated:
- Dashboard
- Records (existing lab tests)
- Machines
- Deliveries
- Stock
- Reports
- Admin → Users / Requests (admin only)

## Technical notes

- All new tables get RLS: approved users (staff/admin) can read/write; only admin can manage users and roles.
- User creation uses `supabaseAdmin.auth.admin.createUser` inside a server function gated by an admin check (no service-role key ever reaches the browser).
- Excel export uses `xlsx` package on the client.
- New routes follow the existing TanStack file-based routing pattern under `_authenticated` (existing protection).

## What I'll ask before building

Two quick confirmations after you approve:
1. For the user-creation flow — should new users be forced to change their temporary password on first sign-in? (recommended: yes)
2. For stock items — do you want me to seed it empty, or pre-populate with common lab consumables you can edit?

Approving this plan kicks off implementation in the order above (admin users → maintenance → deliveries → stock → reports).
