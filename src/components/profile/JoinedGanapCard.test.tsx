import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View as MockView } from 'react-native';
import type { JoinedGanap } from '@/types/profile.types';

interface MockImageProps {
  source: unknown;
  contentFit?: string;
  accessibilityLabel?: string;
}

const mockImageProps: { current: MockImageProps | null } = { current: null };

jest.mock('expo-image', () => ({
  Image: (props: MockImageProps): ReactElement => {
    mockImageProps.current = props;
    return <MockView testID="joined-ganap-image" />;
  },
}));

jest.mock('lucide-react-native', () => ({
  Calendar: (): ReactElement => <MockView testID="joined-ganap-calendar" />,
  CheckCircle2: (): ReactElement => <MockView testID="joined-ganap-check" />,
  ChevronRight: (): ReactElement => <MockView testID="joined-ganap-chevron" />,
  Clock: (): ReactElement => <MockView testID="joined-ganap-clock" />,
}));

import { JoinedGanapCard } from './JoinedGanapCard';

const baseGanap: JoinedGanap = {
  id: 'ganap_1',
  businessId: 'business_1',
  businessName: 'CPU Developers',
  slug: 'cpu-developers-meetup',
  title: 'CPU Developers Meetup',
  startDate: '2026-08-08T02:00:00.000Z',
  endDate: '2026-08-08T04:00:00.000Z',
  status: 'PUBLISHED',
  tags: ['study'],
  coverImage: null,
  registrationStatus: 'REGISTERED',
  registeredAt: '2026-08-01T00:00:00.000Z',
};

afterEach((): void => {
  mockImageProps.current = null;
  jest.clearAllMocks();
});

describe('JoinedGanapCard media', (): void => {
  it('renders the Ganap cover image in the media slot', async (): Promise<void> => {
    const screen = await render(
      <JoinedGanapCard ganap={{ ...baseGanap, coverImage: 'https://cdn.example.test/cover.jpg' }} />,
    );

    expect(screen.getByTestId('joined-ganap-image')).toBeTruthy();
    expect(mockImageProps.current).toMatchObject({
      source: { uri: 'https://cdn.example.test/cover.jpg' },
      contentFit: 'cover',
      accessibilityLabel: 'CPU Developers Meetup event image',
    });
  });

  it('uses the calendar icon when the Ganap has no cover image', async (): Promise<void> => {
    const screen = await render(<JoinedGanapCard ganap={baseGanap} />);

    expect(screen.queryByTestId('joined-ganap-image')).toBeNull();
    expect(screen.getByTestId('joined-ganap-calendar')).toBeTruthy();
  });
});

describe('JoinedGanapCard icon spacing', (): void => {
  it('puts spacing on wrappers around inline icons', async (): Promise<void> => {
    const screen = await render(<JoinedGanapCard ganap={baseGanap} onPress={(): void => {}} />);

    expect(screen.getByTestId('joined-ganap-clock').parent?.props.className).toContain('mr-xs');
    expect(screen.getByTestId('joined-ganap-check').parent?.props.className).toContain('mr-xs');
    expect(screen.getByTestId('joined-ganap-chevron').parent?.props.className).toContain('ml-xs');
  });
});
