export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  displayPicture?: string | null;
  bio?: string | null;
  interests: string[];
  isVerified: boolean;
  createdAt: string;
  googleId?: string | null;
  isAdmin?: boolean;
}
