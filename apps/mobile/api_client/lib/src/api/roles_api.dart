//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:omnistock_api_client/src/api_util.dart';
import 'package:omnistock_api_client/src/model/capability_catalog.dart';
import 'package:omnistock_api_client/src/model/error_response.dart';
import 'package:omnistock_api_client/src/model/role_detail.dart';
import 'package:omnistock_api_client/src/model/role_detail_list_page.dart';

class RolesApi {

  final Dio _dio;

  final Serializers _serializers;

  const RolesApi(this._dio, this._serializers);

  /// The capability catalog this shop can see (role checklist)
  /// F-003 (api-spec §1, §3 · D-037). The ONE source of capability keys, their Thai labels and descriptions, groups, status and &#x60;implies&#x60; edges — clients render the checklist from this and never hard-code a key (AC-7.1).  Org-scoped and requires &#x60;manage_roles&#x60;: a tier that needs an entitlement is HIDDEN entirely, not flagged (AC-7.4), so the answer can differ per shop — cache it per shop. &#x60;full_access&#x60; is present with &#x60;selectable: false&#x60; and &#x60;group: null&#x60; so a role holding it can be labelled; it is never a checklist item. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [CapabilityCatalog] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<CapabilityCatalog>> getOrgCapabilityCatalog({ 
    required String orgId,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/capabilities'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        if (xOrganizationId != null) r'X-Organization-Id': xOrganizationId,
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearerAuth',
          },
        ],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    CapabilityCatalog? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(CapabilityCatalog),
      ) as CapabilityCatalog;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<CapabilityCatalog>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// One role of this shop, in full (edit and clone screens)
  /// F-003 (api-spec §1, §3). The same &#x60;RoleDetail&#x60; as the matching item of &#x60;GET /orgs/{orgId}/role-details&#x60;. Requires &#x60;manage_roles&#x60;.  &#x60;lastEdited.by&#x60; is decided at read time against THIS shop only: &#x60;me&#x60;, a current member (their CURRENT role here), or &#x60;former_member&#x60; — never an e-mail, a user id, or anything from another shop. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [roleId] - Role id (`RoleDetail.id`).
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [RoleDetail] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<RoleDetail>> getOrgRoleDetail({ 
    required String orgId,
    required String roleId,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/roles/{roleId}'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString()).replaceAll('{' r'roleId' '}', encodeQueryParameter(_serializers, roleId, const FullType(String)).toString());
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        if (xOrganizationId != null) r'X-Organization-Id': xOrganizationId,
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearerAuth',
          },
        ],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    RoleDetail? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(RoleDetail),
      ) as RoleDetail;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<RoleDetail>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// Every live role of this shop, in full (the role list screen)
  /// F-003 (api-spec §1, §3). Each item is a &#x60;RoleDetail&#x60; — capabilities, usage counts, who edited it last and the caller&#39;s per-role verdicts — and the page carries the create verdict and the role ceiling. Requires &#x60;manage_roles&#x60;.  A separate path from &#x60;GET /orgs/{orgId}/roles&#x60; on purpose: that list is readable by every active member and does NOT publish &#x60;capabilities&#x60; (AC-6.4); one route, one capability.  One page, oldest first (&#x60;createdAt asc, id asc&#x60;); &#x60;nextCursor&#x60; is always &#x60;null&#x60; while the role ceiling fits in a page. &#x60;viewer.*&#x60; is a UX input — a write re-reads permissions and may still refuse. While role writes are switched off every write verdict is &#x60;writes_disabled&#x60;. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [RoleDetailListPage] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<RoleDetailListPage>> listOrgRoleDetails({ 
    required String orgId,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/role-details'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        if (xOrganizationId != null) r'X-Organization-Id': xOrganizationId,
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearerAuth',
          },
        ],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    RoleDetailListPage? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(RoleDetailListPage),
      ) as RoleDetailListPage;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<RoleDetailListPage>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

}
