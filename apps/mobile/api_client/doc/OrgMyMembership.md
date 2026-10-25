# omnistock_api_client.model.OrgMyMembership

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**roleId** | **String** |  | 
**roleName** | **String** |  | 
**roleKey** | **String** | `owner|admin|staff` for a system role, `null` for an F-003 custom one. Open set — an unknown value MUST fall back to showing `roleName`. ⛔ Never use it to decide permissions; use `capabilities`.  | 
**roleNameCustomized** | **bool** | F-003 (AC-1.5) — the shop renamed this role (always `true` for a role with `roleKey: null`). Display `roleNameCustomized ? roleName : (translate roleKey ?? roleName)`. Absent (older server) = `false`.  | [optional] 
**capabilities** | **BuiltList&lt;String&gt;** | What the client may OFFER. Not enforcement — the server refuses the call regardless (architecture §3.1).  F-003: the STORED canonical set of the caller's role — NOT expanded, so a key implied by another key in the set is not repeated (api-spec §3.1(1)). To tell the user what a role edit would take away from them (AC-3.10), compare expanded sets — use core-domain `lostCapabilities` (or its golden vectors), never a plain set difference of this array.  | 
**status** | **String** | Always `active` here — a non-member cannot reach this endpoint. | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


