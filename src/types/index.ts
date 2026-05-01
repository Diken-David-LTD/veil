export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type SubscriptionTier = 'free' | 'premium' | 'executive';

export interface UserProfile {
  uid: string;
  displayName: string;
  bio?: string;
  birthDate: string;
  gender: string;
  interestedIn: string;
  neighborhood: string;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  photoURL?: string;
  swipeCount: number;
  subscriptionTier: SubscriptionTier;
  createdAt: any;
  updatedAt: any;
}

export interface Match {
  id: string;
  users: string[];
  likes: Record<string, string>;
  isMutual: boolean;
  lastMessage?: string;
  updatedAt: string;
  participants?: UserProfile[]; // For frontend convenience
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
  isRead: boolean;
}
