# Organization profile (DS-176)

From Event Details, tap the Hosted by organization card. It pushes the authenticated organization profile, using the Business identity attached to the Ganap. Native back returns to the event; a direct entry has a Home fallback. The profile independently shows loading, missing/error/retry, image fallback, About, optional organization location, website and public contact email actions. It refetches on focus and pull-to-refresh. Event Details also refreshes the independent Business query.

Navigation uses `Routes.businessProfile(businessId)`. For example, `router.push(Routes.businessProfile(ganap.businessId))` opens the organization attached to that Ganap. It reuses `GET /api/v1/businesses/:id` and the token-gated Business query; no unauthenticated server access or organization-event list is added.

Only explicitly supplied Business website/email fields appear. HTTPS links reject credentials; email is validated and encoded into a mail intent. There is no fallback to private account/application details. Both themes use semantic tokens, controls have 48dp targets, text remains scalable, and screen motion uses the native stack.

Route and utility tests cover safe linking, optional data, focus refetch, retry, both theme variants, typed routes and back fallback. Physical device checks remain necessary for native gestures, large text, TalkBack/VoiceOver, and cross-client image appearance.
