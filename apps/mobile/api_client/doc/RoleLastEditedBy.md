# omnistock_api_client.model.RoleLastEditedBy

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**kind** | **String** | OPEN SET. `me` → \"คุณ\" · `member` → the editor's CURRENT role in this shop (the three `role*` fields below) · `former_member` → \"อดีตสมาชิก\" (no longer an active member of this shop, including a deleted account). Any other value → generic copy.  | 
**roleName** | **String** | Present only when `kind` is `member`. Display per AC-1.5. | [optional] 
**roleKey** | **String** | Present only when `kind` is `member`. Translation only — OPEN SET, fall back to `roleName`.  | [optional] 
**roleNameCustomized** | **bool** | Present only when `kind` is `member`. | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


