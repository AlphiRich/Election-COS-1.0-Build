# RBAC UI patterns (from ecos-rbac-config)

## Roles — only these six, from the `role` table
- HQ_ADMIN → "Party HQ" · tenant-wide · can delegate
- LOCAL_HEAD → "Local Election Head" · municipal · can delegate
- FINANCE_OFFICER → "Finance Officer" · tenant-wide · cannot delegate (seed row was previously missing — always show it)
- WARD_LEAD → "Field Coordinator" · ward · can delegate
- VD_CAPTAIN → "VD Captain" · voting district · can delegate
- VOLUNTEER → "Canvasser" · voting district · cannot delegate

UI shows the label; data, tokens, policies and code show the key (in Plex Mono via CodeTag). WBS owner roles (COMPLIANCE_OFFICER, INFORMATION_OFFICER, COMMS_DIRECTOR, FIELD_ORGANIZER) are never login roles. Never hardcode role lists in UI — read them from the registry.

## Capability matrix
Rows = capability keys (household.read, household.write, voter.read, consent.capture, incident.create, pr_list.export, donation.record, demarcation.configure, delegation.grant, rbac.manage). Columns = roles. Cell states: granted (Ink fill), scoped (Blue tint, geographic scope applies), none (dash); Amber underline = delegable.

## Delegation form — show all five checks live, block submit until all pass
1. Delegator's role has can_delegate.
2. Every selected capability is held (and delegable) by the delegator.
3. Every selected voting district is inside the delegator's scope.
4. Delegatee is an operational role (VOLUNTEER) — one level, no sub-delegation.
5. valid_until is set and within the campaign cycle.
Label the panel "Policy checks · enforced by trigger" — the UI mirrors, the database enforces.

## Revocation copy
State the offline tradeoff plainly: "The cached token stays valid offline until it expires (max 8 h). Revocation is enforced the moment the device reconnects, and written to the permission audit log."

## Capability token (CapabilityToken)
Ink panel listing sub, tenant_id, scope, capabilities, iat, exp, kid; Amber lifetime meter. Tokens are short-lived (one operational session) and signed with a rotating ES256 key (active → retiring → retired).

## Audit log
Append-only, hash-chained; columns Seq · Timestamp (SAST) · Actor · Event (CodeTag) · Target · Hash. Events: DELEGATION_GRANTED, DELEGATION_REVOKED, ROLE_ASSIGNED, CAPABILITY_BUNDLE_EDITED, KEY_ROTATED, TOKEN_REVALIDATED.
