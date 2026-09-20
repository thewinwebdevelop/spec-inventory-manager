# omnistock_api_client.model.InvitationPreview

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**organizationName** | **String** |  | 
**roleName** | **String** |  | 
**roleKey** | **String** |  | 
**emailMasked** | **String** | `u***@example.com` — enough to pick the right account, not an address. | 
**expiresAt** | [**DateTime**](DateTime.md) |  | 
**status** | **String** | Always `pending` on a `200`; the other states answer `409`. | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


