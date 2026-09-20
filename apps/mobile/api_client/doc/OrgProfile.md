# omnistock_api_client.model.OrgProfile

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**name** | **String** |  | 
**logo** | **String** |  | 
**timezone** | **String** |  | 
**currency** | **String** | Fixed `THB` in Phase 0 (D-013). Never accepted from a client. | 
**taxProfile** | [**TaxProfileView**](TaxProfileView.md) | `null` when the shop has declared nothing — at EVERY permission tier, so \"not declared\" is not a permission signal either.  | 
**taxProfileComplete** | **bool** | Derived (entity type + tax id + VAT flag all present). Visible to every member. F-002 only reports it; F-007 is what gates features on it.  | 
**entitlement** | [**EntitlementSummary**](EntitlementSummary.md) | `null` only if the shop somehow has no entitlement row. | 
**myMembership** | [**OrgMyMembership**](OrgMyMembership.md) |  | 
**counts** | [**OrgCounts**](OrgCounts.md) |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


