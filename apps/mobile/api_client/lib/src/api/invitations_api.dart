//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:omnistock_api_client/src/api_util.dart';
import 'package:omnistock_api_client/src/model/cancelled_invitation.dart';
import 'package:omnistock_api_client/src/model/create_invitation_request.dart';
import 'package:omnistock_api_client/src/model/error_response.dart';
import 'package:omnistock_api_client/src/model/invitation_accept_result.dart';
import 'package:omnistock_api_client/src/model/invitation_list_page.dart';
import 'package:omnistock_api_client/src/model/invitation_preview.dart';
import 'package:omnistock_api_client/src/model/issued_invitation.dart';
import 'package:omnistock_api_client/src/model/redeem_invitation_request.dart';
import 'package:omnistock_api_client/src/model/reissued_link.dart';

class InvitationsApi {

  final Dio _dio;

  final Serializers _serializers;

  const InvitationsApi(this._dio, this._serializers);

  /// Accept an invitation and join the shop
  /// F-002 US-4 (api-spec §3.15). USER-SCOPED: authenticated, but about the USER, not about an org. The organization comes from the invitation ROW and from nowhere else — &#x60;X-Organization-Id&#x60; is ignored entirely (I-3), which is a structural property of this route rather than a check somebody must remember.  The signed-in account&#39;s normalized email must match the invited address, otherwise &#x60;403 INVITATION_EMAIL_MISMATCH&#x60; with &#x60;details.emailMasked&#x60; so the UI can say which account to use. ⚠️ Phase 0 cannot verify email addresses (F-081), so this is defence in depth, NOT a control: whoever holds the link can redeem it.  Somebody previously REMOVED from the shop comes back only if the invitation was issued AFTER the removal; otherwise &#x60;409 INVITATION_SUPERSEDED&#x60;.  Already an active member → &#x60;409 ALREADY_MEMBER&#x60; and THE EXISTING ROLE IS NOT TOUCHED (the invitation is marked cancelled so it does not linger). An earlier draft upserted the role here, which opened \&quot;accepting an invitation leaves the shop with zero Owners\&quot;.  Decision order, pinned by unit test: unknown token → expired → cancelled/accepted → email mismatch → role unavailable → already a member → superseded → success. Every one of these is re-checked INSIDE the transaction that holds the shop&#39;s row lock, so &#x60;accept&#x60; cannot slip between a &#x60;revoke&#x60;/&#x60;cancel&#x60;/&#x60;reissue&#x60; and win.  &#x60;Cache-Control: no-store&#x60; + &#x60;Referrer-Policy: no-referrer&#x60;. 
  ///
  /// Parameters:
  /// * [redeemInvitationRequest] 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [InvitationAcceptResult] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<InvitationAcceptResult>> acceptInvitation({ 
    required RedeemInvitationRequest redeemInvitationRequest,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/invitations/accept';
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
      const _type = FullType(RedeemInvitationRequest);
      _bodyData = _serializers.serialize(redeemInvitationRequest, specifiedType: _type);

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

    InvitationAcceptResult? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(InvitationAcceptResult),
      ) as InvitationAcceptResult;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<InvitationAcceptResult>(
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

  /// Cancel a pending invitation
  /// F-002 api-spec §3.13. Requires &#x60;manage_members&#x60;. Any link already sent stops working immediately. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [invitationId] - Invitation id (`inv_…`).
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [CancelledInvitation] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<CancelledInvitation>> cancelInvitation({ 
    required String orgId,
    required String invitationId,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/invitations/{invitationId}'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString()).replaceAll('{' r'invitationId' '}', encodeQueryParameter(_serializers, invitationId, const FullType(String)).toString());
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

    CancelledInvitation? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(CancelledInvitation),
      ) as CancelledInvitation;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<CancelledInvitation>(
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

  /// Invite somebody to the shop (returns the link once)
  /// F-002 US-3 (api-spec §3.11, D-012). Requires &#x60;manage_members&#x60;, plus &#x60;full_access&#x60; when the invited role itself holds &#x60;full_access&#x60; (D-028/C-1).  ⚠️ &#x60;token&#x60; and &#x60;inviteUrl&#x60; are shown THIS ONCE. Only an HMAC is stored (D-018), so there is no \&quot;resend the same link\&quot; — and no email is sent (D-012): the UI must offer a copy button and the user forwards it.  LIFETIME DEPENDS ON THE ROLE: 24 hours when the invited role holds &#x60;full_access&#x60; or &#x60;manage_members&#x60;, 7 days otherwise (D-028/I-7). ⛔ The UI must render &#x60;expiresAt&#x60; and never hard-code \&quot;7 days\&quot;.  Inviting an address that already has a live invitation is &#x60;409 INVITATION_PENDING&#x60; WITH &#x60;details.invitationId&#x60; (+ &#x60;expiresAt&#x60;, &#x60;roleId&#x60;, &#x60;roleName&#x60;), so the UI can immediately offer \&quot;issue a new link\&quot; or \&quot;cancel\&quot; instead of leaving the user in a dead end (D-027).  &#x60;Cache-Control: no-store&#x60; + &#x60;Referrer-Policy: no-referrer&#x60; — the body carries a live credential. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [createInvitationRequest] 
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [IssuedInvitation] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<IssuedInvitation>> createInvitation({ 
    required String orgId,
    required CreateInvitationRequest createInvitationRequest,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/invitations'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
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
      const _type = FullType(CreateInvitationRequest);
      _bodyData = _serializers.serialize(createInvitationRequest, specifiedType: _type);

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

    IssuedInvitation? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(IssuedInvitation),
      ) as IssuedInvitation;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<IssuedInvitation>(
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

  /// List the shop&#39;s invitations
  /// F-002 api-spec §3.10. Requires &#x60;manage_members&#x60; — every row carries somebody else&#39;s email address (PDPA, D-028/I-8).  Never returns a token or a link: only an HMAC of the token is stored (D-018), so there is nothing to return. Use &#x60;POST /orgs/{orgId}/invitations/{invitationId}/link&#x60; to mint a new one.  The members screen is ONE screen with TWO sections, fetched from this endpoint and &#x60;GET /orgs/{orgId}/members&#x60; separately and NOT merged (ux Q1): the two sources have different states and different actions (reissue/cancel vs change-role/remove), each with its own cursor and its own error states.  ⚠️ &#x60;?withTotal&#x3D;true&#x60; is NOT supported here — see the T-002-21 report.  &#x60;Cache-Control: no-store&#x60; + &#x60;Referrer-Policy: no-referrer&#x60;. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [status] - Default `pending` — the actionable view. Any other value → `422`.
  /// * [cursor] - Opaque keyset cursor from the previous page's `nextCursor`. Base64url — clients MUST NOT decode or construct one. Unreadable value → `422 VALIDATION_FAILED` with `fieldErrors.cursor`. 
  /// * [limit] - Page size. Default 25, clamped to 100. Non-integer / < 1 → `422 VALIDATION_FAILED` with `fieldErrors.limit` (a bug is not silently corrected). 
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [InvitationListPage] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<InvitationListPage>> listInvitations({ 
    required String orgId,
    String? status = 'pending',
    String? cursor,
    int? limit = 25,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/invitations'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString());
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
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    InvitationListPage? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(InvitationListPage),
      ) as InvitationListPage;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<InvitationListPage>(
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

  /// Look at an invitation before signing in or signing up (public)
  /// F-002 US-4 (api-spec §3.14). PUBLIC — the invite page has to render before the person decides whether to sign in or sign up, so there is nobody to authenticate. The quota is therefore the ONLY bound on this endpoint: 30/hour per IP (IPv6 collapsed to /64, so one subscriber cannot mint unlimited buckets).  ⛔ THE TOKEN IS IN THE BODY, NOT THE QUERY STRING (I-6). It is the single secret standing between a stranger and membership of a shop; in a URL it would be written to access logs, to every proxy in front of us and to the &#x60;Referer&#x60; of anything the invite page loads. A free side effect: a POST is not cached by anything.  Returns no &#x60;organizationId&#x60;, no full email address and no member list.  &#x60;Cache-Control: no-store&#x60; + &#x60;Referrer-Policy: no-referrer&#x60;.  @frontend: read the token out of the URL, &#x60;history.replaceState&#x60; it away immediately, and keep it in memory (never localStorage) for the whole sign-up → sign-in → accept flow. 
  ///
  /// Parameters:
  /// * [redeemInvitationRequest] 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [InvitationPreview] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<InvitationPreview>> previewInvitation({ 
    required RedeemInvitationRequest redeemInvitationRequest,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/invitations/preview';
    final _options = Options(
      method: r'POST',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[],
        ...?extra,
      },
      contentType: 'application/json',
      validateStatus: validateStatus,
    );

    dynamic _bodyData;

    try {
      const _type = FullType(RedeemInvitationRequest);
      _bodyData = _serializers.serialize(redeemInvitationRequest, specifiedType: _type);

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

    InvitationPreview? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(InvitationPreview),
      ) as InvitationPreview;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<InvitationPreview>(
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

  /// Issue a NEW link for an existing invitation (rotates the token)
  /// F-002 api-spec §3.12 (D-027). Requires &#x60;manage_members&#x60;, plus &#x60;full_access&#x60; when the INVITATION&#39;s role holds &#x60;full_access&#x60; (NEW-2) — reissuing an Owner invitation is handing out Owner, so the rule that gates creating one gates copying it too. Without that, anyone with &#x60;manage_members&#x60; could make unlimited copies of the Owner key and the D-028 rule would be bypassed wholesale.  ⚠️ &#x60;200&#x60;, NOT &#x60;201&#x60; — nothing is created; an existing invitation&#39;s token is rotated. (The implementation shipped &#x60;201&#x60; in T-002-19 and was corrected to the locked contract in a follow-up commit, rather than the contract being bent to the code.)  ⚠️ THE PREVIOUS LINK STOPS WORKING IMMEDIATELY, and the expiry RESTARTS from now (&#x60;now + TTL(role)&#x60;), so an elevated-role invitation can be extended 24 hours at a time. The UI needs a confirmation dialog and must not use the words \&quot;copy the existing link\&quot;.  The invitation&#39;s email and role do not change. Every call emits &#x60;org.invitation.link_reissued&#x60; so a leaked link can be traced.  An EXPIRED invitation can still be reissued (its stored status is still &#x60;pending&#x60;) — deliberately, to avoid a dead end on screen; with the Owner-only rule in place, forbidding it would buy no security.  &#x60;Cache-Control: no-store&#x60; + &#x60;Referrer-Policy: no-referrer&#x60;. 
  ///
  /// Parameters:
  /// * [orgId] - Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
  /// * [invitationId] - Invitation id (`inv_…`).
  /// * [xOrganizationId] - Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [ReissuedLink] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<ReissuedLink>> reissueInvitationLink({ 
    required String orgId,
    required String invitationId,
    String? xOrganizationId,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orgs/{orgId}/invitations/{invitationId}/link'.replaceAll('{' r'orgId' '}', encodeQueryParameter(_serializers, orgId, const FullType(String)).toString()).replaceAll('{' r'invitationId' '}', encodeQueryParameter(_serializers, invitationId, const FullType(String)).toString());
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
      validateStatus: validateStatus,
    );

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    ReissuedLink? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(ReissuedLink),
      ) as ReissuedLink;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<ReissuedLink>(
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
