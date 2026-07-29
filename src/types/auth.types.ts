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
  displayPicture?: string;
  interests?: string[];
}

export interface GoogleAuthRequestDto {
  idToken: string;
}

export interface UploadAvatarResponse {
  url: string;
}
