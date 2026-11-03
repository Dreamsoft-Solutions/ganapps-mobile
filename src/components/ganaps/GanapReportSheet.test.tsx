import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import type { GanapReportReceipt, ReportGanapInput } from '@/types/ganap.types';

const mockShowToast = jest.fn<(type: string, title: string) => string>().mockReturnValue('toast');

jest.mock('@/store/toast.store', () => ({
  showToast: (type: string, title: string): string => mockShowToast(type, title),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));
jest.mock('lucide-react-native', () => ({
  LucideProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
  X: (): null => null,
}));
jest.mock('@/hooks/useResolvedTheme', () => ({ useResolvedTheme: (): 'light' => 'light' }));

import { GanapReportSheet } from './GanapReportSheet';

const receipt: GanapReportReceipt = { status: 'SUBMITTED', submittedAt: '2026-11-03T09:00:00.000Z' };

beforeEach((): void => {
  mockShowToast.mockClear();
});

describe('GanapReportSheet', (): void => {
  it('sends the chosen reason with trimmed details, confirms, and closes', async (): Promise<void> => {
    const onSubmit = jest.fn<(input: ReportGanapInput) => Promise<GanapReportReceipt>>().mockResolvedValue(receipt);
    const onClose = jest.fn<() => void>();
    const screen = await render(
      <GanapReportSheet visible ganapTitle="Sunset Acoustic Night" onClose={onClose} onSubmit={onSubmit} />,
    );

    expect(screen.getByRole('button', { name: 'Submit report' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Misleading or false information' }));
    await fireEvent.changeText(screen.getByLabelText('Details (optional)'), '  The venue is wrong  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit report' }));

    expect(onSubmit).toHaveBeenCalledWith({ reason: 'MISLEADING_INFORMATION', details: 'The venue is wrong' });
    expect(mockShowToast).toHaveBeenCalledWith('success', "Report received. We'll review it.");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the sheet open and explains a duplicate report', async (): Promise<void> => {
    const duplicate = Object.assign(new Error('You have already reported this Ganap.'), {
      errorCode: 'GANAP_REPORT_DUPLICATE',
    });
    const onSubmit = jest.fn<(input: ReportGanapInput) => Promise<GanapReportReceipt>>().mockRejectedValue(duplicate);
    const onClose = jest.fn<() => void>();
    const screen = await render(
      <GanapReportSheet visible ganapTitle="Sunset Acoustic Night" onClose={onClose} onSubmit={onSubmit} />,
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Spam or scam' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Submit report' }));

    expect(screen.getByText("You've already reported this event. We'll review it.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('renders nothing while hidden', async (): Promise<void> => {
    const screen = await render(
      <GanapReportSheet
        visible={false}
        ganapTitle="Sunset Acoustic Night"
        onClose={(): void => {}}
        onSubmit={async (): Promise<GanapReportReceipt> => receipt}
      />,
    );

    expect(screen.queryByText('Report this event')).toBeNull();
  });
});
