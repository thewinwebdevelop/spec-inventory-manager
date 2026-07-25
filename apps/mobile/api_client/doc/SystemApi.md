# omnistock_api_client.api.SystemApi

## Load the API package
```dart
import 'package:omnistock_api_client/api.dart';
```

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getHealth**](SystemApi.md#gethealth) | **GET** /health | Liveness/readiness probe


# **getHealth**
> HealthResponse getHealth()

Liveness/readiness probe

F-000 seed endpoint — proves the contracts codegen pipeline end to end. Implemented by apps/api in T-000-08 (incl. redis/bullmq probe, AC15). Response shape here covers the minimal AC11 seam; richer probe detail is added by T-000-08 without breaking this shape (additive only, see contract-evolution skill). 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getSystemApi();

try {
    final response = api.getHealth();
    print(response);
} on DioException catch (e) {
    print('Exception when calling SystemApi->getHealth: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**HealthResponse**](HealthResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

