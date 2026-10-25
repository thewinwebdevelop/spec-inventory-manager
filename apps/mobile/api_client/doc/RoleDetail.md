# omnistock_api_client.model.RoleDetail

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**name** | **String** | The stored name, already normalised (NFC, trimmed, inner whitespace collapsed). Display rule (AC-1.5): `nameCustomized ? name : (translate key ?? name)`.  | 
**key** | **String** | Stable slug for TRANSLATION ONLY: `owner`, `admin` or `staff` for the system presets, `null` for every role a user created. OPEN SET — on `null` or an unrecognised value fall back to `name`.  ⛔ NEVER a permission input. Whether a role grants ownership is `grantsOwnership`; what it allows is `capabilities`.  | 
**nameCustomized** | **bool** | The shop renamed this role (always `true` for a role with `key: null`). When `true`, show `name` as-is instead of translating `key`.  | 
**isSystem** | **bool** | The locked Owner role. It can be neither edited, renamed nor deleted. `viewer` already says so per action — use this for labelling only.  | 
**grantsOwnership** | **bool** | Derived server-side from `capabilities` (`full_access`), never from `key`.  | 
**capabilities** | **BuiltList&lt;String&gt;** | The CANONICAL stored set, sorted by key (api-spec §2): a key implied by another key in the set is not repeated. The Owner role is exactly `[\"full_access\"]`. May contain keys whose catalog `status` is `upcoming`, and — from an older catalog — keys a client does not know: render those generically, never drop them silently.  | 
**version** | **int** | Optimistic-concurrency token. Send it back unchanged in `UpdateRoleRequest.version`. On a version conflict the client MUST re-fetch this role and show the difference — it must never resubmit automatically with the newer version (AC-3.12).  | 
**usage** | [**RoleUsage**](RoleUsage.md) |  | 
**lastEdited** | [**RoleLastEdited**](RoleLastEdited.md) | `null` = never edited since the system provisioned it (\"ค่าเริ่มต้นของระบบ\", AC-9.6).  | 
**viewer** | [**RoleDetailViewer**](RoleDetailViewer.md) |  | 
**createdAt** | [**DateTime**](DateTime.md) |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


