//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:omnistock_api_client/src/api_util.dart';
import 'package:omnistock_api_client/src/model/capability_catalog.dart';
import 'package:omnistock_api_client/src/model/create_role_request.dart';
import 'package:omnistock_api_client/src/model/deleted_role.dart';
import 'package:omnistock_api_client/src/model/error_response.dart';
import 'package:omnistock_api_client/src/model/role_detail.dart';
import 'package:omnistock_api_client/src/model/role_detail_list_page.dart';
import 'package:omnistock_api_client/src/model/update_role_request.dart';

class RolesApi {

  final Dio _dio;

  final Serializers _serializers;

  const RolesApi(this._dio, this._serializers);

  /// Create a custom role (also how \&quot;clone\&quot; is done)
  /// F-003 (api-spec §1, §2, AC-3.1..3.7, AC-4.2, AC-5.1). Requires &#x60;manage_roles&#x60;. There is no clone endpoint: the client pre-fills this request from the source role (&#x60;RoleDetail&#x60;) and sends it like any create.  The created role always has &#x60;key: null&#x60; and &#x60;isSystem: false&#x60;; &#x60;key&#x60;, &#x60;isSystem&#x60; and &#x60;version&#x60; in the body are ignored (AC-1.4). &#x60;name&#x60; comes back normalised (NFC, trimmed, inner whitespace collapsed) and &#x60;capabilities&#x60; in canonical form (deduplicated, implied keys removed, sorted).  ⚠️ ROLLOUT FLAG: while &#x60;ROLE_WRITES_ENABLED&#x60; is off the server answers &#x60;503 ROLE_WRITES_DISABLED&#x60; to callers who hold &#x60;manage_roles&#x60; — the same state &#x60;viewer.canCreate.reason &#x3D; \&quot;writes_disabled\&quot;&#x60; already reports. A caller WITHOUT &#x60;manage_roles&#x60; gets &#x60;403 FORBIDDEN&#x60; either way.  FIXED CHECK ORDER (api-spec §2): &#x60;manage_roles&#x60; (&#x60;403 FORBIDDEN&#x60;) → flag (&#x60;503&#x60;) → rate limit (&#x60;429&#x60;) → &#x60;manage_roles&#x60; re-read inside the transaction (&#x60;403 FORBIDDEN&#x60;) → body shape (&#x60;422 VALIDATION_FAILED&#x60;) → name (&#x60;422 VALIDATION_FAILED&#x60; length / invisible characters, then &#x60;409 ROLE_NAME_TAKEN&#x60; for a reserved system-role label) → &#x60;ROLE_EMPTY&#x60; → &#x60;FULL_ACCESS_RESERVED&#x60; → &#x60;UNKNOWN_CAPABILITY&#x60; → &#x60;ROLE_EXCEEDS_ACTOR&#x60; → &#x60;ROLE_LIMIT_REACHED&#x60; → write (a live role with the same name, ignoring case → &#x60;409 ROLE_NAME_TAKEN&#x60;).  Rate limit &#x60;roleWrite&#x60;: 60 role writes per hour per shop, shared by create / update / delete. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [createRoleRequest] 
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
  Future<Response<RoleDetail>> createOrgRole({ 
    required String orgId,
    required CreateRoleRequest createRoleRequest,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/roles'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
    final _options = Options(
      method: r'POST',
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
      contentType: 'application/json',
      validateStatus: validateStatus,
    );

    dynamic _bodyData;

    try {
      const _type = FullType(CreateRoleRequest);
      _bodyData = _serializers.serialize(createRoleRequest, specifiedType: _type);

    } catch(error, stackTrace) {
      throw DioException(
         requestOptions: _options.compose(
          _dio.options,
          _path,
        ),
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    final _response = await _dio.request<Object>(
      _path,
      data: _bodyData,
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

  /// Delete a role (soft)
  /// F-003 (api-spec §1, §2, AC-3.8, AC-3.9, AC-3.9b, AC-4.1, AC-5.1, D-034 Addendum + Addendum 2). Requires &#x60;manage_roles&#x60;. No request body and no &#x60;version&#x60;.  SOFT delete: the role disappears from every live list (&#x60;GET /roles&#x60;, &#x60;GET /role-details&#x60;, &#x60;GET /roles/{roleId}&#x60; → &#x60;404&#x60;, invite / change-role choices) and its name becomes free again, but history keeps showing it — revoked members and accepted / cancelled invitations still carry its &#x60;roleName&#x60;.  A role can be deleted only when nobody uses it: no ACTIVE member holds it (you included) and no PENDING invitation names it — an expired link that was never accepted or cancelled still counts (&#x60;409 ROLE_IN_USE&#x60;, with the two counts in &#x60;details&#x60;; &#x60;GET /members?roleId&#x3D;&#x60; and &#x60;GET /invitations?roleId&#x3D;&#x60; list the same people and links).  A role other ACTIVE members hold is refused BEFORE &#x60;ROLE_IN_USE&#x60; when the caller could not move them anyway: no &#x60;manage_members&#x60; (&#x60;403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS&#x60; — stay on the screen; &#x60;viewer.canDelete.reason &#x3D; \&quot;in_use_requires_manage_members\&quot;&#x60;), or the role holds exactly what the caller holds (&#x60;403 TARGET_NOT_BELOW_ACTOR&#x60;; reason &#x60;equal_permissions_in_use&#x60;). The Owner passes both and gets &#x60;ROLE_IN_USE&#x60;.  ⚠️ ROLLOUT FLAG: while &#x60;ROLE_WRITES_ENABLED&#x60; is off the server answers &#x60;503 ROLE_WRITES_DISABLED&#x60; to callers who hold &#x60;manage_roles&#x60; (&#x60;viewer.canDelete.reason &#x3D; \&quot;writes_disabled\&quot;&#x60;). A caller WITHOUT &#x60;manage_roles&#x60; gets &#x60;403 FORBIDDEN&#x60; either way.  FIXED CHECK ORDER (api-spec §2): &#x60;manage_roles&#x60; (&#x60;403 FORBIDDEN&#x60;) → flag (&#x60;503&#x60;) → rate limit (&#x60;429&#x60;) → the role exists in this shop and is not deleted (&#x60;404&#x60;) → &#x60;manage_roles&#x60; re-read inside the transaction (&#x60;403 FORBIDDEN&#x60;) → the Owner role (&#x60;409 ROLE_LOCKED&#x60;) → &#x60;ROLE_EXCEEDS_ACTOR&#x60; → &#x60;ROLE_HELD_REQUIRES_MANAGE_MEMBERS&#x60; → &#x60;TARGET_NOT_BELOW_ACTOR&#x60; → &#x60;ROLE_IN_USE&#x60; → &#x60;ROLE_HISTORY_LIMIT_REACHED&#x60; → delete (&#x60;200&#x60;).  Rate limit &#x60;roleWrite&#x60;: 60 role writes per hour per shop, shared by create / update / delete. 
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
  /// Returns a [Future] containing a [Response] with a [DeletedRole] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<DeletedRole>> deleteOrgRole({ 
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
      method: r'DELETE',
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

    DeletedRole? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(DeletedRole),
      ) as DeletedRole;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<DeletedRole>(
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

  /// Rename a role and/or replace its capabilities
  /// F-003 (api-spec §1, §2, AC-3.3, AC-3.10, AC-3.12, AC-4.1, AC-5.1, D-034 Addendum + Addendum 2). Requires &#x60;manage_roles&#x60;. &#x60;version&#x60; is required — the &#x60;RoleDetail.version&#x60; the user was looking at. &#x60;capabilities&#x60; is the WHOLE new set (replace, not a diff); &#x60;name&#x60; and &#x60;capabilities&#x60; are each optional, but at least one must be sent.  NO-OP: when the normalised name and the canonical capability set are what is already stored, the answer is &#x60;200&#x60; with the CURRENT role — &#x60;version&#x60; is not compared (a stale one is fine), nothing is written and no event fires. The no-op is decided only AFTER every permission rule, so a no-op on a role you may not edit is still refused.  ⚠️ &#x60;409 ROLE_CHANGED&#x60;: someone saved the role after you loaded it. The client MUST re-fetch &#x60;GET /orgs/{orgId}/roles/{roleId}&#x60; and show the difference for the user to decide — it must NEVER resubmit automatically with &#x60;details.currentVersion&#x60; (that is the last-write-wins AC-3.12 forbids).  A role other ACTIVE members hold (counted on the server, the caller excluded): the caller must also hold &#x60;manage_members&#x60; (&#x60;403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS&#x60; — stay on the screen and re-fetch; &#x60;viewer.canEdit.reason &#x3D; \&quot;in_use_requires_manage_members\&quot;&#x60;), and the role as it is now must hold strictly less than the caller (&#x60;403 TARGET_NOT_BELOW_ACTOR&#x60;; reason &#x60;equal_permissions_in_use&#x60;). This applies to every field, a rename included. The Owner passes both.  Editing your own role is allowed (only within your own capabilities); losing a capability takes effect on your next request (AC-3.10 — the client warns first). Making a role hold &#x60;manage_members&#x60; / &#x60;manage_roles&#x60; shortens its pending invitations to 24 hours from issue (never lengthens them).  ⚠️ ROLLOUT FLAG: while &#x60;ROLE_WRITES_ENABLED&#x60; is off the server answers &#x60;503 ROLE_WRITES_DISABLED&#x60; to callers who hold &#x60;manage_roles&#x60; (&#x60;viewer.canEdit.reason &#x3D; \&quot;writes_disabled\&quot;&#x60;). A caller WITHOUT &#x60;manage_roles&#x60; gets &#x60;403 FORBIDDEN&#x60; either way.  FIXED CHECK ORDER (api-spec §2): &#x60;manage_roles&#x60; (&#x60;403 FORBIDDEN&#x60;) → flag (&#x60;503&#x60;) → rate limit (&#x60;429&#x60;) → the role exists in this shop and is not deleted (&#x60;404&#x60;) → &#x60;manage_roles&#x60; re-read inside the transaction (&#x60;403 FORBIDDEN&#x60;) → the Owner role (&#x60;409 ROLE_LOCKED&#x60;) → body shape (&#x60;422 VALIDATION_FAILED&#x60;) → name (&#x60;422 VALIDATION_FAILED&#x60;, then &#x60;409 ROLE_NAME_TAKEN&#x60; for a reserved label) → &#x60;ROLE_EMPTY&#x60; → &#x60;FULL_ACCESS_RESERVED&#x60; → &#x60;UNKNOWN_CAPABILITY&#x60; → &#x60;ROLE_EXCEEDS_ACTOR&#x60; → &#x60;ROLE_HELD_REQUIRES_MANAGE_MEMBERS&#x60; → &#x60;TARGET_NOT_BELOW_ACTOR&#x60; → no-op (&#x60;200&#x60;) → write (&#x60;409 ROLE_CHANGED&#x60;; a live role with the same name → &#x60;409 ROLE_NAME_TAKEN&#x60;).  Rate limit &#x60;roleWrite&#x60;: 60 role writes per hour per shop, shared by create / update / delete. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [roleId] - Role id (`RoleDetail.id`).
  /// * [updateRoleRequest] 
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
  Future<Response<RoleDetail>> updateOrgRole({ 
    required String orgId,
    required String roleId,
    required UpdateRoleRequest updateRoleRequest,
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
      method: r'PATCH',
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
      contentType: 'application/json',
      validateStatus: validateStatus,
    );

    dynamic _bodyData;

    try {
      const _type = FullType(UpdateRoleRequest);
      _bodyData = _serializers.serialize(updateRoleRequest, specifiedType: _type);

    } catch(error, stackTrace) {
      throw DioException(
         requestOptions: _options.compose(
          _dio.options,
          _path,
        ),
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    final _response = await _dio.request<Object>(
      _path,
      data: _bodyData,
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

}
