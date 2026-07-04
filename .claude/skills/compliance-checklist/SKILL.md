---
name: compliance-checklist
description: >-
  PDPA (Thai Personal Data Protection Act) and data-compliance pass for an
  OmniStock feature. Use at Gate 1 for any feature touching personal data —
  accounts, memberships, orders (marketplace buyer names/addresses/phones),
  documents with TIN, notifications, exports, AI add-ons. Produces a
  compliance note in the Gate-1 spec. Owned by product (requirements) with
  backend-api (enforcement seams).
---

# Compliance — tenant data AND their customers' data

OmniStock holds two layers of personal data: (1) our users (tenant staff), and
(2) **our tenants' customers** — buyer names, addresses, phone numbers flowing
in from every synced order. Layer 2 is the big one: PDPA applies, and we are a
**data processor** for the tenant. Design it in at Gate 1; retrofitting
data-handling is a schema migration.

## Gate-1 compliance note (answer all, in the spec)
1. **Inventory:** which personal-data fields does this feature collect/store/
   display? (name, address, phone, email, TIN, buyer chat, images…)
2. **Purpose & basis:** why do we need each field? (contract performance for
   the tenant is the usual basis — say so explicitly.) Don't collect beyond the
   purpose (minimization — e.g. do we need the buyer's full address after the
   parcel ships, or only on the label?).
3. **Retention:** how long, and what happens then (delete/anonymize/archive)?
   Tax documents have statutory retention (Full tier) — flag conflicts between
   "right to erasure" and "must keep tax records" explicitly; statutory wins,
   but scope it narrowly.
4. **Subject rights seam:** can we **delete and export** this data per person
   if asked? If a design makes deletion impossible (e.g. PII inside the
   immutable ledger), that's a design defect — keep PII **out of ledger rows**
   (reference by id, not by embedded name/address).
5. **Exposure:** who sees it (role/capability per F-003)? Does it appear in
   logs, exports, notifications, LINE messages, AI-provider calls? (AI add-on:
   buyer data never leaves to a provider without explicit design + D-XXX.)
6. **Processor duties:** for buyer data we process on the tenant's behalf —
   note it, so Terms/DPA (launch-readiness) can be written from these notes.

## Standing rules (all features)
- PII never in: ledger rows, log lines (mask), URLs, client storage, error
  reporters, or third-party calls not designed for it.
- Cross-tenant isolation *is* a PDPA control — golden rule 3 evidence doubles
  as compliance evidence.
- Deactivate-not-delete (F-002) is fine for *accounts*, but personal data
  inside a deactivated record still ages per the retention answer.
- New personal-data category (e.g. phone OTP identifiers) → append the impact
  to this feature's note + `forward-commitments` if deferred.

Output: a "Compliance note" section in the Gate-1 F-XXX spec; unresolved legal
questions are flagged to the user (we don't guess law — we surface it).
