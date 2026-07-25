# omnistock_api_client.model.TokenResponse

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**accessToken** | **String** | HS256 JWT access token (Bearer). 15-minute TTL. | 
**refreshToken** | **String** | The rotated refresh token on the BODY transport; `null` on the cookie transport (the token is in the httpOnly `omni_rt` cookie, never JS-readable — H-1).  | 
**expiresIn** | **int** | Access-token TTL in seconds (900). | 
**tokenType** | **String** |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


