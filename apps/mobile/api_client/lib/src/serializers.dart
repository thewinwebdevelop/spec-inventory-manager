//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_import

import 'package:one_of_serializer/any_of_serializer.dart';
import 'package:one_of_serializer/one_of_serializer.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:built_value/standard_json_plugin.dart';
import 'package:built_value/iso_8601_date_time_serializer.dart';
import 'package:omnistock_api_client/src/date_serializer.dart';
import 'package:omnistock_api_client/src/model/date.dart';

import 'package:omnistock_api_client/src/model/admin_reset_request.dart';
import 'package:omnistock_api_client/src/model/change_password_request.dart';
import 'package:omnistock_api_client/src/model/error_response.dart';
import 'package:omnistock_api_client/src/model/error_response_error.dart';
import 'package:omnistock_api_client/src/model/health_response.dart';
import 'package:omnistock_api_client/src/model/health_response_checks.dart';
import 'package:omnistock_api_client/src/model/login_request.dart';
import 'package:omnistock_api_client/src/model/logout_request.dart';
import 'package:omnistock_api_client/src/model/ok_response.dart';
import 'package:omnistock_api_client/src/model/refresh_request.dart';
import 'package:omnistock_api_client/src/model/session.dart';
import 'package:omnistock_api_client/src/model/sessions_response.dart';
import 'package:omnistock_api_client/src/model/signup_request.dart';
import 'package:omnistock_api_client/src/model/signup_response.dart';
import 'package:omnistock_api_client/src/model/token_response.dart';

part 'serializers.g.dart';

@SerializersFor([
  AdminResetRequest,
  ChangePasswordRequest,
  ErrorResponse,
  ErrorResponseError,
  HealthResponse,
  HealthResponseChecks,
  LoginRequest,
  LogoutRequest,
  OkResponse,
  RefreshRequest,
  Session,
  SessionsResponse,
  SignupRequest,
  SignupResponse,
  TokenResponse,
])
Serializers serializers = (_$serializers.toBuilder()
      ..add(const OneOfSerializer())
      ..add(const AnyOfSerializer())
      ..add(const DateSerializer())
      ..add(Iso8601DateTimeSerializer())
    ).build();

Serializers standardSerializers =
    (serializers.toBuilder()..addPlugin(StandardJsonPlugin())).build();
