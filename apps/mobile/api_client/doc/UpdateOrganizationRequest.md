# omnistock_api_client.model.UpdateOrganizationRequest

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **String** |  | [optional] 
**logo** | **String** | ⛔ Phase 0 accepts `null` and NOTHING ELSE (M-4). Any string → `422 VALIDATION_FAILED` with `fieldErrors.logo = \"ยังไม่รองรับการตั้งโลโก้ในเวอร์ชันนี้\"`. An arbitrary URL here would make every member of the shop fetch a resource chosen by whoever holds `manage_org_settings`.  | [optional] 
**timezone** | **String** | IANA zone from `Intl.supportedValuesOf('timeZone')`; anything else is 422. | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


