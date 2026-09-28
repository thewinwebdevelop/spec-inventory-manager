# omnistock_api_client.model.RoleWriteVerdict

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**allowed** | **bool** |  | 
**reason** | **String** | `null` when `allowed` is `true`. OPEN SET (api-spec §3), first match wins in this fixed order: `writes_disabled` → `role_locked` → `exceeds_your_permissions` → `in_use_requires_manage_members` → `equal_permissions_in_use` → `in_use` → `history_limit_reached`; `canClone` uses `owner_role` · `exceeds_your_permissions` · `role_limit_reached` · `writes_disabled`; `canCreate` uses `role_limit_reached` · `writes_disabled`. `writes_disabled` outranks every other reason while role writes are switched off. Any other value → generic copy.  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


