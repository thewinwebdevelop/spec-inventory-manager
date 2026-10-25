# omnistock_api_client.model.CapabilityEntry

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**key** | **String** | Stable snake_case identifier — the value stored in `RoleDetail.capabilities`. OPEN SET: new keys ship with new features.  | 
**labelTh** | **String** |  | 
**descriptionTh** | **String** | One sentence — what holding it actually lets someone do. | 
**group** | **String** | A `CapabilityGroup.key`, or `null` for an entry that is not a checklist item (`full_access`). OPEN SET — an unknown group goes in a generic section.  | 
**status** | **String** | OPEN SET. `live` · `upcoming` (shown as \"เร็ว ๆ นี้\"; may be ticked in advance, AC-7.5). Any other value → generic copy.  | 
**implies** | **BuiltList&lt;String&gt;** | Keys granted automatically with this one (one level only, e.g. `manage_X` → `view_X`). Shown ticked and disabled.  | 
**selectable** | **bool** | `false` = may never appear in a create/update request (`full_access`).  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


