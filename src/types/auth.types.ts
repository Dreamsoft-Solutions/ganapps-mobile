import type { User } from './user.types';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface GoogleAuthResponse extends TokenResponse {
  user: User;
  inviteId?: string;
}

export interface RegisterResponse extends TokenResponse {
  user: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    createdAt: string;
  };
  inviteId?: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface VerifyEmailRequest {
  code: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  bio?: string;
  displayPicture?: string;
  interests?: string[];
}

export type DeleteAccountStatus = 'DELETED' | 'ALREADY_DELETED';

export type FirebaseIdentityDeletion = 'QUEUED' | 'NOT_LINKED';

export interface DeleteAccountResponse {
  status: DeleteAccountStatus;
  deletedAt: string;
  firebaseIdentityDeletion: FirebaseIdentityDeletion;
}

export interface DeleteAccountInput {
  confirmationPhrase: string;
  idempotencyKey: string;
}

export interface GoogleAuthRequestDto {
  idToken: string;
}
