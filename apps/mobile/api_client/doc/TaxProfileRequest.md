# omnistock_api_client.model.TaxProfileRequest

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**entityType** | **String** |  | [optional] 
**taxId** | **String** | 13 digits + checksum (data-model §6). Separators are stripped before storage, so `1-1017-00207-36-6` and `1101700207366` are one value. Rejected → `422 TAX_ID_INVALID` + `fieldErrors.taxId`. ⚠️ With `entityType: personal` this IS the owner's national ID. It is never logged, never echoed back, and never appears in any response except `POST /orgs/{orgId}/tax-profile/reveal`.  | [optional] 
**vatRegistered** | **bool** | A real boolean — the string `\"true\"` is refused, not coerced. | [optional] 
**branchCode** | **String** | Optional. `\"00000\"` = head office. | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


