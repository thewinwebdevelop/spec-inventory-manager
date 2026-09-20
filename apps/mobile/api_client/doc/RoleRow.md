# omnistock_api_client.model.RoleRow

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**name** | **String** | Display name. F-003 lets people rename roles, so do NOT map this to Thai copy — use `key`, and fall back to this string.  | 
**key** | **String** | Stable slug for TRANSLATION ONLY (ux Q4). Guaranteed `owner`, `admin` or `staff` for the three system roles — those values are part of the contract and changing one is a breaking change. `null` for any role F-003 lets a user create, because `key` is the system's namespace.  OPEN SET: on `null` or an unrecognised value the client MUST fall back to `name`. Never `switch` without a default.  ⛔ NEVER a permission input, on either side. \"Is this the Owner?\" is answered by capabilities alone (architecture §3.2 / data-model §5.2); @qa's I-45 flips a Staff role's `key` to `\"owner\"` in the database to prove a client that trusted it would be wrong.  | 
**grantsOwnership** | **bool** | Does granting this role grant OWNERSHIP? Derived server-side from `capabilities` (`full_access`), never from `key` — @qa's I-45 flips a Staff role's key to `\"owner\"` in the database precisely to prove the difference.  ⚠️ OPTIONAL on purpose (contract-evolution): a client newer than the server must not fail to parse a role list, so absent means \"this server does not say\" and the client falls back to its previous behaviour. It is a UX input — which option to disable, and why — never a permission check: the server refuses an over-privileged grant regardless (C-1/D-028).  | [optional] 
**isSystem** | **bool** | True for roles the system provisions with the shop. F-003 will refuse to delete these.  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


