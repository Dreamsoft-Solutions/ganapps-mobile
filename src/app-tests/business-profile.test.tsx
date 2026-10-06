import { fireEvent, render } from '@testing-library/react-native';
import { useEffect as mockUseEffect, type ReactElement, type ReactNode } from 'react';
import { Linking, Text as MockNativeText } from 'react-native';
import type { BusinessDetail } from '@/types/business.types';

const mockRefetch = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
const mockBack = jest.fn<void, []>();
const mockReplace = jest.fn<void, [unknown]>();
const mockProfile: BusinessDetail = {
  id: 'business_1',
  name: 'Community events',
  slug: 'community',
  verificationStatus: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
  websiteUrl: 'https://example.com/events',
  publicContactEmail: 'hello@example.com',
};
const mockQuery: {
  data: BusinessDetail | undefined;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  refetch: typeof mockRefetch;
} = { data: mockProfile, isLoading: false, isRefetching: false, error: null, refetch: mockRefetch };
let mockCanGoBack: boolean = true;
let mockTheme: 'light' | 'dark' = 'light';

jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options: { headerLeft: () => ReactElement } }): ReactElement => options.headerLeft(),
  },
  useLocalSearchParams: (): { 'business-id': string } => ({ 'business-id': 'business_1' }),
  useRouter: (): { canGoBack: () => boolean; back: typeof mockBack; replace: typeof mockReplace } => ({
    canGoBack: (): boolean => mockCanGoBack,
    back: mockBack,
    replace: mockReplace,
  }),
  useFocusEffect: (callback: () => void): void => mockUseEffect(callback, [callback]),
}));
jest.mock('@/hooks/queries/useBusinessesQuery', () => ({ useBusinessDetailQuery: (): typeof mockQuery => mockQuery }));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): ReactElement => <MockNativeText>Back icon</MockNativeText>,
  Building2: (): ReactElement => <MockNativeText>Organization image</MockNativeText>,
  LucideProvider: ({ children }: { children: ReactNode }): ReactNode => children,
}));
jest.mock('@/store/auth.store', () => ({ useAuthStore: (): string => 'test-token' }));
jest.mock('@/hooks/useResolvedTheme', () => ({ useResolvedTheme: (): 'light' | 'dark' => mockTheme }));
jest.mock('@/components/common/Avatar', () => ({
  Avatar: ({ name }: { name: string }): ReactElement => <MockNativeText>{name} avatar</MockNativeText>,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 0,
    bottom: 24,
    left: 0,
    right: 0,
  }),
}));

import BusinessProfileScreen from '@/app/(app)/(home)/organizations/[business-id]';
import { Routes } from '@/constants/routes';

beforeEach((): void => {
  jest.clearAllMocks();
  mockQuery.data = mockProfile;
  mockQuery.error = null;
  mockQuery.isLoading = false;
  mockCanGoBack = true;
  mockTheme = 'light';
});
describe('organization profile route', (): void => {
  it('keeps a back action available while loading', async (): Promise<void> => {
    mockQuery.isLoading = true;
    mockQuery.data = undefined;
    const screen = await render(<BusinessProfileScreen />);
    expect(screen.queryByText('Visit website')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
  it.each(['light', 'dark'] as const)('renders optional public links in %s and opens platform intents', async (theme:
    | 'light'
    | 'dark'): Promise<void> => {
    mockTheme = theme;
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const screen = await render(<BusinessProfileScreen />);
    expect(screen.getByText('Community events')).toBeTruthy();
    expect(mockRefetch).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Visit website'));
    await fireEvent.press(screen.getByText('Email organization'));
    expect(open).toHaveBeenCalledWith('https://example.com/events');
    expect(open).toHaveBeenCalledWith('mailto:hello%40example.com');
    open.mockRestore();
  });
  it('hides missing links and provides a description fallback', async (): Promise<void> => {
    mockQuery.data = { ...mockProfile, websiteUrl: null, publicContactEmail: null };
    const screen = await render(<BusinessProfileScreen />);
    expect(screen.queryByText('Visit website')).toBeNull();
    expect(screen.queryByText('Email organization')).toBeNull();
    expect(screen.getByText('This organization has not added a description yet.')).toBeTruthy();
  });
  it('keeps back available during missing/error state and retries independently', async (): Promise<void> => {
    mockQuery.data = undefined;
    mockQuery.error = new Error('Organization not found');
    const screen = await render(<BusinessProfileScreen />);
    await fireEvent.press(screen.getByText('Try Again'));
    expect(mockRefetch).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
  it('uses the typed organization route and falls back to Home for direct navigation', async (): Promise<void> => {
    expect(Routes.businessProfile('business_1')).toEqual({
      pathname: '/(app)/(home)/organizations/[business-id]',
      params: { 'business-id': 'business_1' },
    });
    mockCanGoBack = false;
    const screen = await render(<BusinessProfileScreen />);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith(Routes.app.home);
  });
});
