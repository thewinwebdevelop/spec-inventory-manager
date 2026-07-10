# omnistock_api_client.model.LoginRequest

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**email** | **String** |  | 
**password** | **String** |  | 
**deviceId** | **String** | Client session label (arch §4). Not a security boundary. | [optional] 
**tokenTransport** | **String** | Refresh-token delivery channel (api-spec §0). Web sends \"cookie\"; mobile omits or sends \"body\".  | [optional] [default to 'body']

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


