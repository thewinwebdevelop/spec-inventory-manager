//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:built_value/json_object.dart';
import 'package:omnistock_api_client/src/api_util.dart';
import 'package:omnistock_api_client/src/model/create_organization_request.dart';
import 'package:omnistock_api_client/src/model/created_organization.dart';
import 'package:omnistock_api_client/src/model/error_response.dart';
import 'package:omnistock_api_client/src/model/my_organizations_page.dart';
import 'package:omnistock_api_client/src/model/org_profile.dart';
import 'package:omnistock_api_client/src/model/role_list_page.dart';
import 'package:omnistock_api_client/src/model/tax_id_reveal.dart';
import 'package:omnistock_api_client/src/model/tax_profile_request.dart';
import 'package:omnistock_api_client/src/model/update_organization_request.dart';

class OrganizationsApi {

  final Dio _dio;

  final Serializers _serializers;

  const OrganizationsApi(this._dio, this._serializers);

  /// Create a shop (organization)
  /// F-002 US-1 (api-spec §3.1). USER-SCOPED: there is no org context on this request and there must not be one — the shop does not exist yet, so any &#x60;X-Organization-Id&#x60; the caller sends is ignored (I-3).  The &#x60;201&#x60; is deliberately complete enough to enter the new shop immediately (ux Q5): org, the creator&#39;s membership + role, the entitlement and the default warehouse. Seed the cache from it; do not refetch &#x60;GET /me/organizations&#x60; before navigating.  Everything is provisioned in ONE transaction: Organization + the three system Roles + the creator&#39;s Owner Membership + OrgEntitlement + a default Warehouse. The plan comes from a server-side env seam and FAILS CLOSED (&#x60;503 ORG_PROVISIONING_UNAVAILABLE&#x60;) rather than falling back to a tier nobody authorised.  Rate limit 10/hour/user (abuse control, fails OPEN if Redis is down). The 50-shops-per-user cap is enforced separately IN the transaction and fails CLOSED (&#x60;409 ORG_LIMIT_REACHED&#x60; with &#x60;details.limit&#x60;). 
  ///
  /// Parameters:
  /// * [createOrganizationRequest] 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [CreatedOrganization] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<CreatedOrganization>> createOrganization({ 
    required CreateOrganizationRequest createOrganizationRequest,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/organizations';
    final _options = Options(
      method: r'POST',
      headers: <String, dynamic>{
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
      const _type = FullType(CreateOrganizationRequest);
      _bodyData = _serializers.serialize(createOrganizationRequest, specifiedType: _type);

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

    CreatedOrganization? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(CreatedOrganization),
      ) as CreatedOrganization;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<CreatedOrganization>(
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

  /// Shop profile (org + plan + tax status + my membership)
  /// F-002 api-spec §3.3. Any ACTIVE member may call it; the body is safe for them because it goes through the PDPA mapper — no member list, no full tax id, and &#x60;taxIdMasked&#x60; only for a caller holding &#x60;manage_org_settings&#x60; (ux Q13, which is stricter than D-028).  &#x60;myMembership.capabilities&#x60; exists so the client can hide buttons it should not offer. It is NOT enforcement — the server refuses the call regardless.  &#x60;Cache-Control: no-store&#x60; always: the body carries the shop&#39;s name and its tax status. 
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
  /// Returns a [Future] containing a [Response] with a [OrgProfile] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<OrgProfile>> getOrganization({ 
    required String orgId,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
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

    OrgProfile? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(OrgProfile),
      ) as OrgProfile;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<OrgProfile>(
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

  /// List the shops I belong to (org switcher)
  /// F-002 US-2 (api-spec §3.2). USER-SCOPED — \&quot;which shops am I in?\&quot; has no single org to be scoped to, so &#x60;X-Organization-Id&#x60; is ignored (I-3).  &#x60;status&#x3D;active&#x60; (the default) is evaluated as a DATABASE FILTER on every request: no cache, no TTL. A client that receives &#x60;403 ORG_ACCESS_DENIED&#x60; refetches this endpoint and the shop it was removed from is already gone (AC US-5 / D-027).  &#x60;status&#x3D;all&#x60; additionally returns shops the caller was removed from, and those rows come back in the SHORT shape — id, name, status, &#x60;revokedAt&#x60; and nothing else (M-10). The role they held and the plan that shop is on are internal facts about an organization they are no longer part of.  ⚠️ &#x60;?withTotal&#x3D;true&#x60; is NOT supported here (see the T-002-21 report): api-spec §1 states the convention generally, but only &#x60;GET /orgs/{orgId}/members&#x60; implements it. An unknown query parameter is ignored, so asking for it simply yields no &#x60;total&#x60;. 
  ///
  /// Parameters:
  /// * [status] - `active` (default) returns the full shape. `all` adds shops the caller was removed from, in the short shape. Any other value → `422`. 
  /// * [cursor] - Opaque keyset cursor from the previous page's `nextCursor`. Base64url — clients MUST NOT decode or construct one. Unreadable value → `422 VALIDATION_FAILED` with `fieldErrors.cursor`. 
  /// * [limit] - Page size. Default 25, clamped to 100. Non-integer / < 1 → `422 VALIDATION_FAILED` with `fieldErrors.limit` (a bug is not silently corrected). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [MyOrganizationsPage] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<MyOrganizationsPage>> listMyOrganizations({ 
    String? status = 'active',
    String? cursor,
    int? limit = 25,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/me/organizations';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
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

    final _queryParameters = <String, dynamic>{
      if (status != null) r'status': encodeQueryParameter(_serializers, status, const FullType(String)),
      if (cursor != null) r'cursor': encodeQueryParameter(_serializers, cursor, const FullType(String)),
      if (limit != null) r'limit': encodeQueryParameter(_serializers, limit, const FullType(int)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    MyOrganizationsPage? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(MyOrganizationsPage),
      ) as MyOrganizationsPage;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<MyOrganizationsPage>(
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

  /// List this shop&#39;s roles (the invite dropdown)
  /// F-002 (api-spec §3.6). Any ACTIVE member may read it: the response carries no personal data and nothing about anybody else — three role names the caller can already see on their own membership. Requiring &#x60;manage_members&#x60; would mean a Staff member could not be shown the name of their own role.  It exists because AC US-3 makes choosing a role MANDATORY when inviting somebody: without this endpoint no client can populate that dropdown, so the acceptance criterion could not be met at all.  Read-only in F-002. F-003 adds create/update/delete. 
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
  /// Returns a [Future] containing a [Response] with a [RoleListPage] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<RoleListPage>> listOrgRoles({ 
    required String orgId,
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

    RoleListPage? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(RoleListPage),
      ) as RoleListPage;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<RoleListPage>(
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

  /// Declare (or clear) the shop&#39;s legal tax identity
  /// F-002 US-7 (api-spec §3.5). Requires &#x60;manage_org_settings&#x60;. &#x60;PUT&#x60; of the WHOLE set: send the complete declaration, or &#x60;{}&#x60; to clear it. There is no half-declared state (data-model §3.3), so a partial body is &#x60;422&#x60; with a message on every field that is missing.  ⚠️ THE RESPONSE DOES NOT ECHO &#x60;taxId&#x60; BACK. It is the ordinary §3.3 profile body — &#x60;taxIdMasked&#x60; at most. The caller typed the number, so returning it adds nothing and only multiplies the places a full TIN appears. The value is never logged either; the security event records &#x60;taxIdPresent&#x60; and &#x60;entityType&#x60; only.  F-002 stores the declaration and exposes &#x60;taxProfileComplete&#x60;. Gating features on it is F-007&#39;s job, not this endpoint&#39;s. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [taxProfileRequest] 
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [OrgProfile] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<OrgProfile>> putTaxProfile({ 
    required String orgId,
    required TaxProfileRequest taxProfileRequest,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/tax-profile'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
    final _options = Options(
      method: r'PUT',
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
      const _type = FullType(TaxProfileRequest);
      _bodyData = _serializers.serialize(taxProfileRequest, specifiedType: _type);

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

    OrgProfile? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(OrgProfile),
      ) as OrgProfile;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<OrgProfile>(
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

  /// Reveal the shop&#39;s full tax id (deliberate, recorded, rate-limited)
  /// F-002 api-spec §3.16 (ux Q7/Q13, D-030/NEW-11). Requires &#x60;manage_org_settings&#x60; — which Admin also holds, decided deliberately: the person who files the shop&#39;s tax documents has to be able to read the number. It is fenced by CONTROLS rather than by hiding it:   (a) a deliberate action, never a side effect of opening the shop page;   (b) &#x60;org.tax_profile.revealed&#x60; on every success (the event carries NO TIN);   (c) 20/hour per (user, shop);   (d) &#x60;no-store&#x60; + &#x60;no-cache&#x60; + &#x60;no-referrer&#x60;;   (e) &#x60;TAX_ID_RESPONSE_ALLOWLIST&#x60; &#x3D; this route and nothing else, CI-pinned.   &#x60;POST&#x60; with an empty body &#x60;{}&#x60;, not &#x60;GET&#x60;: a GET would record a national-ID lookup in browser history, in proxy access logs and in the &#x60;Referer&#x60; of the next outbound link.  &#x60;200&#x60;, not &#x60;201&#x60; — nothing is created.  Known limitation (forward-commitment): the Owner has no screen showing these reveal events until F-005. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [body] - Empty object. There is no input — the shop comes from the context.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [TaxIdReveal] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<TaxIdReveal>> revealTaxId({ 
    required String orgId,
    String? xOrganizationId,
    JsonObject? body,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/tax-profile/reveal'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
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
      _bodyData = body;

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

    TaxIdReveal? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(TaxIdReveal),
      ) as TaxIdReveal;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<TaxIdReveal>(
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

  /// Update the shop&#39;s name / logo / timezone
  /// F-002 api-spec §3.4. Requires &#x60;manage_org_settings&#x60;. Returns the SAME body as &#x60;GET&#x60; — one mapper, so the field-level authorization cannot drift between the two.  An absent key means \&quot;leave alone\&quot;; an empty patch is a valid no-op that returns the current profile. &#x60;logo&#x60; accepts &#x60;null&#x60; and nothing else until F-040 mints object keys (M-4). 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [updateOrganizationRequest] 
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [OrgProfile] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<OrgProfile>> updateOrganization({ 
    required String orgId,
    required UpdateOrganizationRequest updateOrganizationRequest,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
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
      const _type = FullType(UpdateOrganizationRequest);
      _bodyData = _serializers.serialize(updateOrganizationRequest, specifiedType: _type);

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

    OrgProfile? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(OrgProfile),
      ) as OrgProfile;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<OrgProfile>(
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
