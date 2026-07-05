# omnistock_api_client.model.HealthResponseChecks

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**db** | **String** | Postgres reachability via PrismaService's `SELECT 1`. | [optional] 
**redis** | **String** | Redis/BullMQ reachability via the ioredis connection's PING + a BullMQ queue call.  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


