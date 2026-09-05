// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'serializers.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

Serializers _$serializers = (Serializers().toBuilder()
      ..add(AcceptedMembership.serializer)
      ..add(AcceptedMembershipStatusEnum.serializer)
      ..add(AdminResetRequest.serializer)
      ..add(CancelledInvitation.serializer)
      ..add(CancelledInvitationStatusEnum.serializer)
      ..add(ChangePasswordRequest.serializer)
      ..add(CreateInvitationRequest.serializer)
      ..add(CreateOrganizationRequest.serializer)
      ..add(CreatedOrganization.serializer)
      ..add(EntitlementSummary.serializer)
      ..add(ErrorResponse.serializer)
      ..add(ErrorResponseError.serializer)
      ..add(HealthResponse.serializer)
      ..add(HealthResponseChecks.serializer)
      ..add(HealthResponseChecksDbEnum.serializer)
      ..add(HealthResponseChecksRedisEnum.serializer)
      ..add(HealthResponseStatusEnum.serializer)
      ..add(Invitation.serializer)
      ..add(InvitationAcceptResult.serializer)
      ..add(InvitationAcceptResultOrganization.serializer)
      ..add(InvitationListPage.serializer)
      ..add(InvitationPreview.serializer)
      ..add(InvitationPreviewStatusEnum.serializer)
      ..add(InvitationStatusEnum.serializer)
      ..add(IssuedInvitation.serializer)
      ..add(LeaveOrgResult.serializer)
      ..add(LeaveOrgResultStatusEnum.serializer)
      ..add(LoginRequest.serializer)
      ..add(LoginRequestTokenTransportEnum.serializer)
      ..add(LogoutRequest.serializer)
      ..add(MemberListPage.serializer)
      ..add(MemberRow.serializer)
      ..add(MemberRowStatusEnum.serializer)
      ..add(MyOrganizationItem.serializer)
      ..add(MyOrganizationMembership.serializer)
      ..add(MyOrganizationMembershipStatusEnum.serializer)
      ..add(MyOrganizationsPage.serializer)
      ..add(NewOrganization.serializer)
      ..add(NewOrganizationMembership.serializer)
      ..add(OkResponse.serializer)
      ..add(OrgCounts.serializer)
      ..add(OrgMyMembership.serializer)
      ..add(OrgProfile.serializer)
      ..add(OrganizationSummary.serializer)
      ..add(RedeemInvitationRequest.serializer)
      ..add(RefreshRequest.serializer)
      ..add(ReissuedLink.serializer)
      ..add(RevokeMemberResult.serializer)
      ..add(RevokeMemberResultStatusEnum.serializer)
      ..add(RoleListPage.serializer)
      ..add(RoleRow.serializer)
      ..add(Session.serializer)
      ..add(SessionsResponse.serializer)
      ..add(SignupRequest.serializer)
      ..add(SignupResponse.serializer)
      ..add(TaxIdReveal.serializer)
      ..add(TaxIdRevealEntityTypeEnum.serializer)
      ..add(TaxProfileRequest.serializer)
      ..add(TaxProfileRequestEntityTypeEnum.serializer)
      ..add(TaxProfileView.serializer)
      ..add(TaxProfileViewEntityTypeEnum.serializer)
      ..add(TokenResponse.serializer)
      ..add(TokenResponseTokenTypeEnum.serializer)
      ..add(UpdateMemberRoleRequest.serializer)
      ..add(UpdateOrganizationRequest.serializer)
      ..add(WarehouseSummary.serializer)
      ..addBuilderFactory(
          const FullType(BuiltList, const [const FullType(Invitation)]),
          () => ListBuilder<Invitation>())
      ..addBuilderFactory(
          const FullType(BuiltList, const [const FullType(MemberRow)]),
          () => ListBuilder<MemberRow>())
      ..addBuilderFactory(
          const FullType(BuiltList, const [const FullType(MyOrganizationItem)]),
          () => ListBuilder<MyOrganizationItem>())
      ..addBuilderFactory(
          const FullType(BuiltList, const [const FullType(RoleRow)]),
          () => ListBuilder<RoleRow>())
      ..addBuilderFactory(
          const FullType(BuiltList, const [const FullType(Session)]),
          () => ListBuilder<Session>())
      ..addBuilderFactory(
          const FullType(BuiltList, const [const FullType(String)]),
          () => ListBuilder<String>())
      ..addBuilderFactory(
          const FullType(BuiltMap, const [
            const FullType(String),
            const FullType.nullable(JsonObject)
          ]),
          () => MapBuilder<String, JsonObject?>())
      ..addBuilderFactory(
          const FullType(
              BuiltMap, const [const FullType(String), const FullType(String)]),
          () => MapBuilder<String, String>()))
    .build();

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
