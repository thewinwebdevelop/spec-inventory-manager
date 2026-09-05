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

import 'package:omnistock_api_client/src/model/accepted_membership.dart';
import 'package:omnistock_api_client/src/model/admin_reset_request.dart';
import 'package:omnistock_api_client/src/model/cancelled_invitation.dart';
import 'package:omnistock_api_client/src/model/change_password_request.dart';
import 'package:omnistock_api_client/src/model/create_invitation_request.dart';
import 'package:omnistock_api_client/src/model/create_organization_request.dart';
import 'package:omnistock_api_client/src/model/created_organization.dart';
import 'package:omnistock_api_client/src/model/entitlement_summary.dart';
import 'package:omnistock_api_client/src/model/error_response.dart';
import 'package:omnistock_api_client/src/model/error_response_error.dart';
import 'package:omnistock_api_client/src/model/health_response.dart';
import 'package:omnistock_api_client/src/model/health_response_checks.dart';
import 'package:omnistock_api_client/src/model/invitation.dart';
import 'package:omnistock_api_client/src/model/invitation_accept_result.dart';
import 'package:omnistock_api_client/src/model/invitation_accept_result_organization.dart';
import 'package:omnistock_api_client/src/model/invitation_list_page.dart';
import 'package:omnistock_api_client/src/model/invitation_preview.dart';
import 'package:omnistock_api_client/src/model/issued_invitation.dart';
import 'package:omnistock_api_client/src/model/leave_org_result.dart';
import 'package:omnistock_api_client/src/model/login_request.dart';
import 'package:omnistock_api_client/src/model/logout_request.dart';
import 'package:omnistock_api_client/src/model/member_list_page.dart';
import 'package:omnistock_api_client/src/model/member_row.dart';
import 'package:omnistock_api_client/src/model/my_organization_item.dart';
import 'package:omnistock_api_client/src/model/my_organization_membership.dart';
import 'package:omnistock_api_client/src/model/my_organizations_page.dart';
import 'package:omnistock_api_client/src/model/new_organization.dart';
import 'package:omnistock_api_client/src/model/new_organization_membership.dart';
import 'package:omnistock_api_client/src/model/ok_response.dart';
import 'package:omnistock_api_client/src/model/org_counts.dart';
import 'package:omnistock_api_client/src/model/org_my_membership.dart';
import 'package:omnistock_api_client/src/model/org_profile.dart';
import 'package:omnistock_api_client/src/model/organization_summary.dart';
import 'package:omnistock_api_client/src/model/redeem_invitation_request.dart';
import 'package:omnistock_api_client/src/model/refresh_request.dart';
import 'package:omnistock_api_client/src/model/reissued_link.dart';
import 'package:omnistock_api_client/src/model/revoke_member_result.dart';
import 'package:omnistock_api_client/src/model/role_list_page.dart';
import 'package:omnistock_api_client/src/model/role_row.dart';
import 'package:omnistock_api_client/src/model/session.dart';
import 'package:omnistock_api_client/src/model/sessions_response.dart';
import 'package:omnistock_api_client/src/model/signup_request.dart';
import 'package:omnistock_api_client/src/model/signup_response.dart';
import 'package:omnistock_api_client/src/model/tax_id_reveal.dart';
import 'package:omnistock_api_client/src/model/tax_profile_request.dart';
import 'package:omnistock_api_client/src/model/tax_profile_view.dart';
import 'package:omnistock_api_client/src/model/token_response.dart';
import 'package:omnistock_api_client/src/model/update_member_role_request.dart';
import 'package:omnistock_api_client/src/model/update_organization_request.dart';
import 'package:omnistock_api_client/src/model/warehouse_summary.dart';

part 'serializers.g.dart';

@SerializersFor([
  AcceptedMembership,
  AdminResetRequest,
  CancelledInvitation,
  ChangePasswordRequest,
  CreateInvitationRequest,
  CreateOrganizationRequest,
  CreatedOrganization,
  EntitlementSummary,
  ErrorResponse,
  ErrorResponseError,
  HealthResponse,
  HealthResponseChecks,
  Invitation,
  InvitationAcceptResult,
  InvitationAcceptResultOrganization,
  InvitationListPage,
  InvitationPreview,
  IssuedInvitation,
  LeaveOrgResult,
  LoginRequest,
  LogoutRequest,
  MemberListPage,
  MemberRow,
  MyOrganizationItem,
  MyOrganizationMembership,
  MyOrganizationsPage,
  NewOrganization,
  NewOrganizationMembership,
  OkResponse,
  OrgCounts,
  OrgMyMembership,
  OrgProfile,
  OrganizationSummary,
  RedeemInvitationRequest,
  RefreshRequest,
  ReissuedLink,
  RevokeMemberResult,
  RoleListPage,
  RoleRow,
  Session,
  SessionsResponse,
  SignupRequest,
  SignupResponse,
  TaxIdReveal,
  TaxProfileRequest,
  TaxProfileView,
  TokenResponse,
  UpdateMemberRoleRequest,
  UpdateOrganizationRequest,
  WarehouseSummary,
])
Serializers serializers = (_$serializers.toBuilder()
      ..add(const OneOfSerializer())
      ..add(const AnyOfSerializer())
      ..add(const DateSerializer())
      ..add(Iso8601DateTimeSerializer())
    ).build();

Serializers standardSerializers =
    (serializers.toBuilder()..addPlugin(StandardJsonPlugin())).build();
