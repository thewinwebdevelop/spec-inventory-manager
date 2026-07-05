# omnistock_api_client.model.HealthResponse

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**status** | **String** | Literal \"ok\" when the service is healthy, \"error\" when one or more dependency checks fail (returned with HTTP 503).  | 
**checks** | [**HealthResponseChecks**](HealthResponseChecks.md) |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


