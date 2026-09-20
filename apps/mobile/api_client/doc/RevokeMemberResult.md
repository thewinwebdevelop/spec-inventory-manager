# omnistock_api_client.model.RevokeMemberResult

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**userId** | **String** |  | 
**status** | **String** | Soft delete — the row stays, so history and `revokedAt` survive. | 
**revokedAt** | [**DateTime**](DateTime.md) |  | 
**cancelledInvitations** | **int** | Pending invitations for that email that were cancelled in the SAME transaction (normally 0 or 1) — so the UI can say \"their pending invitation was withdrawn too\".  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


