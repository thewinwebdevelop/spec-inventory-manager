# omnistock_api_client.model.RoleListPage

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**items** | [**BuiltList&lt;RoleRow&gt;**](RoleRow.md) |  | 
**nextCursor** | **String** | Always `null` in F-002 — a shop has exactly its three system roles until F-003. The field is present so a client written today does not need rewriting the day a fourth role exists.  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


