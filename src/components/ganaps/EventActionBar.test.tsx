import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import type { GanapActionModel } from '@/utils/ganap-detail';

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
}));

import { EventActionBar } from './EventActionBar';

const registeredModel: GanapActionModel = {
  statusLabel: 'Joined',
  primary: { action: 'enter-hub', label: 'Enter Event Hub', confirmation: null },
  secondary: {
    action: 'leave',
    label: 'Leave event',
    confirmation: { title: 'Leave this event?', message: 'Cancelled.', confirmLabel: 'Leave event' },
  },
};

const attendedModel: GanapActionModel = {
  statusLabel: 'Attended',
  primary: { action: 'enter-hub', label: 'Enter Event Hub', confirmation: null },
  secondary: null,
};

const pendingModel: GanapActionModel = {
  statusLabel: 'Awaiting approval',
  primary: {
    action: 'leave',
    label: 'Cancel request',
    confirmation: { title: 'Cancel your request?', message: 'Removed.', confirmLabel: 'Cancel request' },
  },
  secondary: null,
};

describe('EventActionBar', (): void => {
  it('renders Enter Event Hub as primary and Leave event as secondary for a registered model', async (): Promise<void> => {
    const screen = await render(
      <EventActionBar
        model={registeredModel}
        isPending={false}
        onPrimaryAction={(): void => {}}
        onSecondaryAction={(): void => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Enter Event Hub' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leave event' })).toBeTruthy();
  });

  it('renders only the Hub button for an attended model with no secondary action', async (): Promise<void> => {
    const screen = await render(
      <EventActionBar
        model={attendedModel}
        isPending={false}
        onPrimaryAction={(): void => {}}
        onSecondaryAction={(): void => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Enter Event Hub' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Leave event' })).toBeNull();
  });

  it('fills the primary Hub button and outlines the secondary leave button', async (): Promise<void> => {
    const screen = await render(
      <EventActionBar
        model={registeredModel}
        isPending={false}
        onPrimaryAction={(): void => {}}
        onSecondaryAction={(): void => {}}
      />,
    );

    expect(String(screen.getByRole('button', { name: 'Enter Event Hub' }).props.className)).toContain('bg-primary');
    expect(String(screen.getByRole('button', { name: 'Leave event' }).props.className)).toContain('border-input');
  });

  it('keeps a leave action in the primary slot outlined rather than promoting it to a filled CTA', async (): Promise<void> => {
    const screen = await render(
      <EventActionBar
        model={pendingModel}
        isPending={false}
        onPrimaryAction={(): void => {}}
        onSecondaryAction={(): void => {}}
      />,
    );

    const className: string = String(screen.getByRole('button', { name: 'Cancel request' }).props.className);

    expect(className).toContain('border-input');
    expect(className).not.toContain('bg-primary');
  });

  it('invokes only the corresponding callback when each registered button is pressed', async (): Promise<void> => {
    const onPrimaryAction = jest.fn<() => void>();
    const onSecondaryAction = jest.fn<() => void>();
    const screen = await render(
      <EventActionBar
        model={registeredModel}
        isPending={false}
        onPrimaryAction={onPrimaryAction}
        onSecondaryAction={onSecondaryAction}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Enter Event Hub' }));
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onSecondaryAction).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Leave event' }));
    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });
});
