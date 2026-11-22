# omnistock_api_client.model.RoleRow

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**name** | **String** | Display name. Display rule (AC-1.5): `nameCustomized ? name : (translate key ?? name)` — a role the shop renamed shows THIS string, otherwise translate `key` and fall back to it. (A client that ignores `nameCustomized` shows the translation instead of the shop's own name — cosmetic, never a permission issue.)  | 
**key** | **String** | Stable slug for TRANSLATION ONLY (ux Q4). Guaranteed `owner`, `admin` or `staff` for the three system roles — those values are part of the contract and changing one is a breaking change. `null` for any role F-003 lets a user create, because `key` is the system's namespace.  OPEN SET: on `null` or an unrecognised value the client MUST fall back to `name`. Never `switch` without a default.  ⛔ NEVER a permission input, on either side. \"Is this the Owner?\" is answered by capabilities alone (architecture §3.2 / data-model §5.2); @qa's I-45 flips a Staff role's `key` to `\"owner\"` in the database to prove a client that trusted it would be wrong.  | 
**grantsOwnership** | **bool** | Does granting this role grant OWNERSHIP? Derived server-side from `capabilities` (`full_access`), never from `key` — @qa's I-45 flips a Staff role's key to `\"owner\"` in the database precisely to prove the difference.  ⚠️ OPTIONAL on purpose (contract-evolution): a client newer than the server must not fail to parse a role list, so absent means \"this server does not say\" and the client falls back to its previous behaviour. It is a UX input — which option to disable, and why — never a permission check: the server refuses an over-privileged grant regardless (C-1/D-028).  | [optional] 
**isSystem** | **bool** | `true` only for the shop's locked Owner role (F-003): it can be neither edited, renamed nor deleted. Admin and Staff are presets the shop may edit, so they read `false`. Labelling only — use `grantsOwnership` for \"is this ownership?\".  | 
**nameCustomized** | **bool** | F-003 (AC-1.5) — the shop renamed this role (always `true` for a role with `key: null`). When `true`, show `name` as-is instead of translating `key`. Absent (older server) = `false`.  | [optional] 
**viewerCanAssign** | **bool** | F-003 (AC-2.2) — may the CALLER hand out this role (invite with it, or change a member to it)? The same rule the write applies: the role must not grant ownership unless you are an Owner, and must not hold a permission you lack. Show a `false` option DISABLED with the reason — never hide it. A UX input, never enforcement.  Present only when the caller holds `manage_members`.  | [optional] 
**assignBlockedReason** | **String** | Present with `viewerCanAssign`; `null` when it is `true`. OPEN SET: `owner_only` · `exceeds_your_permissions`. Never names the missing permission (`capabilities` stays unpublished here). Any other value → generic copy.  | [optional] 
**inviteTtlHours** | **int** | F-003 (D-039 · AC-10.3) — how many hours an invitation with this role would stay valid, computed from the role's CAPABILITIES by the same rule that sets `Invitation.expiresAt` (today `24` for a role holding `full_access`, `manage_members` or `manage_roles`; `168` otherwise — treat it as a number, not an enum). Never derived from `key` or `name`.  Present ONLY on rows where `viewerCanAssign` is `true` — the caller holds `manage_members` AND may invite with this role, so the number reveals nothing they could not learn by inviting (AC-6.4). Absent everywhere else (no `manage_members`, a role the caller may not assign, the Owner role for a non-Owner) and on older servers.  The client decides the \"short-lived link\" warning from this field ONLY — never from `key`, `name` or `grantsOwnership`. Absent = show no warning. A UX input, never enforcement: the server sets the real expiry regardless.  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


