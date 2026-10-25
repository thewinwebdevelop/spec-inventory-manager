# omnistock_api_client.model.MyOrganizationMembership

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**status** | **String** |  | 
**roleId** | **String** | Present only on the `active` (full) shape. | [optional] 
**roleName** | **String** | Present only on the `active` (full) shape. | [optional] 
**roleKey** | **String** | Present only on the `active` (full) shape. | [optional] 
**roleNameCustomized** | **bool** | F-003 (AC-1.5) — present only on the `active` (full) shape. The shop renamed this role (always `true` when `roleKey` is `null`): show `roleName` as-is instead of translating `roleKey`.  | [optional] 
**revokedAt** | [**DateTime**](DateTime.md) | Present only on the revoked (short) shape. | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


