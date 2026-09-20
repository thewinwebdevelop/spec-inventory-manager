//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:omnistock_api_client/src/api_util.dart';
import 'package:omnistock_api_client/src/model/error_response.dart';
import 'package:omnistock_api_client/src/model/leave_org_result.dart';
import 'package:omnistock_api_client/src/model/member_list_page.dart';
import 'package:omnistock_api_client/src/model/member_row.dart';
import 'package:omnistock_api_client/src/model/revoke_member_result.dart';
import 'package:omnistock_api_client/src/model/update_member_role_request.dart';

class MembersApi {

  final Dio _dio;

  final Serializers _serializers;

  const MembersApi(this._dio, this._serializers);

  /// Leave this shop myself
  /// F-002 US-5 / D-029 (api-spec §3.17). ANY active member may call it — NO &#x60;manage_members&#x60; required.  ⚠️ WHY THIS IS A SEPARATE ROUTE rather than relaxing &#x60;DELETE /orgs/{orgId}/members/{userId}&#x60; when the id happens to be your own:   1. Confused deputy closed BY SHAPE — there is no &#x60;userId&#x60; anywhere in this      route, so the target is &#x60;ctx.userId&#x60; always and no bug can point it at      another person. The alternative closes the same hole with an &#x60;if&#x60;, and      an &#x60;if&#x60; is exactly what finding C-1 was.   2. The route registry stays decidable — the capability guard reads      metadata only; \&quot;the capability depends on a value in the path\&quot; cannot      be expressed in metadata and would push the decision into a service,      where forgetting it is silent.   3. Different event: &#x60;org.member.left&#x60;, not &#x60;org.member.revoked&#x60;. Afterwards      \&quot;did they walk out or were they cleared out?\&quot; is answerable.   Behaviour is identical to §3.9 apart from the actor: soft revoke, own pending invitations cancelled in the same transaction, the shop disappears from &#x60;GET /me/organizations&#x60; immediately, other shops and the session untouched.  &#x60;200&#x60; with a body rather than &#x60;204&#x60;: the caller needs &#x60;cancelledInvitations&#x60; and &#x60;revokedAt&#x60; for the confirmation copy.  ⛔ There is NO &#x60;403 FORBIDDEN&#x60; on this route — there is no capability to lack, so a 403 here can only be &#x60;ORG_ACCESS_DENIED&#x60;.  ⚠️ The last Owner cannot leave (&#x60;409 LAST_OWNER&#x60;) and F-002 has no \&quot;delete shop\&quot;, so the way out is to appoint another Owner first. Accepted limitation. 
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
  /// Returns a [Future] containing a [Response] with a [LeaveOrgResult] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<LeaveOrgResult>> leaveOrganization({ 
    required String orgId,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/membership'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
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

    LeaveOrgResult? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(LeaveOrgResult),
      ) as LeaveOrgResult;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<LeaveOrgResult>(
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

  /// List the shop&#39;s members
  /// F-002 US-5 (api-spec §3.7). ⚠️ THIS READ REQUIRES &#x60;manage_members&#x60;. Every row carries somebody&#39;s email address, which is PII under PDPA (D-028/I-8) — it is not a UX preference, and a Staff member calling it gets &#x60;403 FORBIDDEN&#x60;. If a screen needs \&quot;who did this?\&quot;, take the name/id off the resource rather than pulling the whole directory.  &#x60;status&#x60; defaults to &#x60;all&#x60; here (unlike &#x60;GET /me/organizations&#x60;, whose default is &#x60;active&#x60;): this is the audit view of who is and who WAS in the shop, and hiding removed rows by default would make \&quot;why can this person no longer sign in?\&quot; unanswerable from the UI. &#x60;invited&#x60; is not an accepted value — memberships are only created at accept time (data-model §7), so the filter could only ever return nothing. People invited but not yet joined live in &#x60;GET /orgs/{orgId}/invitations&#x60;.  This is the ONLY list endpoint that supports &#x60;?withTotal&#x3D;true&#x60; today.  &#x60;Cache-Control: no-store&#x60; — a list of email addresses must not sit in a shared cache (M-11). 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [status] - Default `all`. Any other value → `422`.
  /// * [cursor] - Opaque keyset cursor from the previous page's `nextCursor`. Base64url — clients MUST NOT decode or construct one. Unreadable value → `422 VALIDATION_FAILED` with `fieldErrors.cursor`. 
  /// * [limit] - Page size. Default 25, clamped to 100. Non-integer / < 1 → `422 VALIDATION_FAILED` with `fieldErrors.limit` (a bug is not silently corrected). 
  /// * [withTotal] - Opt in to the `total` count on this page. OPT-IN PER ENDPOINT: only the endpoints that declare this parameter compute a total — see the endpoint's own documentation. (`GET /me/organizations` and `GET /orgs/{orgId}/invitations` do NOT support it today; api-spec §1 states the convention generally, the server implements it on `GET /orgs/{orgId}/members` only.) 
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [MemberListPage] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<MemberListPage>> listMembers({ 
    required String orgId,
    String? status = 'all',
    String? cursor,
    int? limit = 25,
    bool? withTotal = false,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/members'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
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

    final _queryParameters = <String, dynamic>{
      if (status != null) r'status': encodeQueryParameter(_serializers, status, const FullType(String)),
      if (cursor != null) r'cursor': encodeQueryParameter(_serializers, cursor, const FullType(String)),
      if (limit != null) r'limit': encodeQueryParameter(_serializers, limit, const FullType(int)),
      if (withTotal != null) r'withTotal': encodeQueryParameter(_serializers, withTotal, const FullType(bool)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    MemberListPage? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(MemberListPage),
      ) as MemberListPage;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<MemberListPage>(
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

  /// Remove another member from the shop
  /// F-002 US-5 (api-spec §3.9). Requires &#x60;manage_members&#x60;, plus &#x60;full_access&#x60; when the target is an Owner (D-028/C-1).  SOFT delete: &#x60;status → revoked&#x60; and &#x60;revokedAt&#x60; is stamped. The row stays, because history references it and because &#x60;revokedAt&#x60; is a security input — an invitation issued BEFORE it can no longer be accepted (I-1).  In the SAME transaction, any pending invitation for that person&#39;s email in this shop is cancelled; &#x60;cancelledInvitations&#x60; reports how many, so the UI can say so.  Effect is immediate: the removed member&#39;s next request to this shop is &#x60;403 ORG_ACCESS_DENIED&#x60; and the shop is gone from their &#x60;GET /me/organizations&#x60;. Their session is not destroyed and their other shops are untouched.  Removing YOURSELF through this route works, but only if you already hold &#x60;manage_members&#x60;. Everyone else uses &#x60;DELETE /orgs/{orgId}/membership&#x60; — this route grants nobody a softer path (D-029).  Idempotency under a race: two concurrent revokes of the same person produce one &#x60;200&#x60; and one &#x60;404&#x60;, and &#x60;revokedAt&#x60; is written once. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [userId] - Target member's user id.
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [RevokeMemberResult] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<RevokeMemberResult>> revokeMember({ 
    required String orgId,
    required String userId,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/members/{userId}'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString()).replaceAll('{' r'userId' '}', encodeQueryParameter(_serializers, userId, const FullType(String)).toString());
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

    RevokeMemberResult? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(RevokeMemberResult),
      ) as RevokeMemberResult;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<RevokeMemberResult>(
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

  /// Change a member&#39;s role
  /// F-002 US-6 (api-spec §3.8). Requires &#x60;manage_members&#x60;, and additionally &#x60;full_access&#x60; (Owner-only, D-028/C-1) when EITHER the new role holds &#x60;full_access&#x60; (promoting somebody — including yourself — to Owner) OR the target&#39;s CURRENT role holds it (editing an Owner). Otherwise &#x60;403 FORBIDDEN&#x60;.  Acting on yourself is allowed (an Owner stepping down after appointing a successor), subject to the last-Owner rule.  Answers with the §3.7 member row, so the client never has to refetch the list to render the new state — which is why this response carries an email address and therefore the §3.7 &#x60;no-store&#x60; policy (api-spec §1 lists §3.7 but not §3.8 by number; the classification follows the SHAPE, and &#x60;RESPONSE_HEADER_POLICY&#x60; in apps/api encodes that).  The target&#39;s state is re-read INSIDE the transaction, after the shop&#39;s row lock is taken — so a &#x60;PATCH&#x60; racing a &#x60;DELETE&#x60; answers &#x60;404&#x60;, never a 500 or a resurrection. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [userId] - Target member's user id.
  /// * [updateMemberRoleRequest] 
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [MemberRow] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<MemberRow>> updateMemberRole({ 
    required String orgId,
    required String userId,
    required UpdateMemberRoleRequest updateMemberRoleRequest,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/members/{userId}'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString()).replaceAll('{' r'userId' '}', encodeQueryParameter(_serializers, userId, const FullType(String)).toString());
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
      const _type = FullType(UpdateMemberRoleRequest);
      _bodyData = _serializers.serialize(updateMemberRoleRequest, specifiedType: _type);

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

    MemberRow? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(MemberRow),
      ) as MemberRow;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<MemberRow>(
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
