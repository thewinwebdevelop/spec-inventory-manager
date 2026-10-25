# omnistock_api_client.model.RoleDetailListPage

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**items** | [**BuiltList&lt;RoleDetail&gt;**](RoleDetail.md) | Every live role of the shop, `createdAt asc, id asc`. | 
**nextCursor** | **String** | Always `null` while the role ceiling fits in one page. Present so a client written today survives the day it is not.  | 
**viewer** | [**RoleDetailListViewer**](RoleDetailListViewer.md) |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


