/** The notification kind handled by the mobile registration-status flow. */
export type NotificationType = 'REGISTRATION_STATUS_UPDATED';

/** Registration states that can be delivered by a registration-status notification. */
export type RegistrationStatusNotificationStatus = 'REGISTERED' | 'WAITLISTED' | 'REJECTED';

/** Validated data carried by a registration-status notification. */
export interface NotificationData {
  type: NotificationType;
  notificationId?: string;
  registrationId?: string;
  ganapId: string;
  registrationStatus: RegistrationStatusNotificationStatus;
}
