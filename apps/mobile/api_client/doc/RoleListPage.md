# omnistock_api_client.model.RoleListPage

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**items** | [**BuiltList&lt;RoleRow&gt;**](RoleRow.md) |  | 
**nextCursor** | **String** | Always `null`: every live role fits in one page while the per-shop role ceiling (30) is below the page maximum (100). Present so a client written today survives the day that stops being true.  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


