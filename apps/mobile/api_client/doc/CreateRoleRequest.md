# omnistock_api_client.model.CreateRoleRequest

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **String** | 1–50 code points AFTER the server normalises it (NFC, trim, collapse inner whitespace); invisible/control characters (Unicode Cc/Cf) are refused. The response carries the normalised name.  | 
**capabilities** | **BuiltList&lt;String&gt;** | Keys from the capability catalog with `selectable: true`. Stored in canonical form (api-spec §2) — the response may differ from what was sent (duplicates and implied keys removed, sorted).  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


