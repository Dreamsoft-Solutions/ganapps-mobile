/** @vitest-environment happy-dom */

import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axiosInstance } from '@/api/axios-instance';
import { useGanapDetailQuery } from '@/hooks/queries/useGanapsQuery';
import { type UseGanapActionResult, useGanapAction } from '@/hooks/useGanapAction';
import { useAuthStore } from '@/store/auth.store';
import type { FormBlock, GanapDetail, RegistrationStatus } from '@/types/ganap.types';

vi.mock('expo-secure-store', () => ({}));

const NOW: Date = new Date('2026-11-20T02:00:00.000Z');
const TIMESTAMP = '2026-11-19T02:00:00.000Z';

const QUESTION: FormBlock = {
  id: 'block-1',
  ganapId: 'ganap-1',
  scope: 'REGISTRATION',
  type: 'TEXT',
  label: 'Organization or school',
  isRequired: true,
  allowMultiple: false,
  order: 0,
  config: null,
  options: [],
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

type FormBlocksReply = FormBlock[] | 'error' | Promise<FormBlock[]>;

interface FakeServer {
  detail: GanapDetail | null;
  formBlocks: FormBlocksReply;
  formBlockRequests: number;
}

const server: FakeServer = { detail: null, formBlocks: [], formBlockRequests: 0 };
const probe: { result: UseGanapActionResult | null } = { result: null };

/** Builds the event an attendee opens, published and starting after {@link NOW}. */
function ganapDetail(
  requiresApproval: boolean,
  status: RegistrationStatus,
  registrationFormSubmittedAt: string | null,
): GanapDetail {
  return {
    id: 'ganap-1',
    businessId: 'business-1',
    businessName: 'Iloilo Organizers',
    slug: 'ganap-1',
    title: 'Riverside meetup',
    description: 'An evening by the river.',
    address: 'Iloilo City',
    locationLat: 10.7,
    locationLong: 122.56,
    startDate: '2026-12-01T10:00:00.000Z',
    endDate: '2026-12-01T12:00:00.000Z',
    attendanceOpenMinutesBefore: 30,
    status: 'PUBLISHED',
    requiresApproval,
    maxAttendees: null,
    tags: [],
    registrationCount: 1,
    myRegistration: { id: 'registration-1', status, createdAt: TIMESTAMP, registrationFormSubmittedAt },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function respond(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    config,
    data: { success: true, statusCode: 200, data, message: 'OK' },
    status: 200,
    statusText: 'OK',
    headers: {},
  };
}

function serverError(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError('Request failed with status code 500', AxiosError.ERR_BAD_RESPONSE, config, null, {
    config,
    data: { success: false, statusCode: 500, message: 'Internal server error' },
    status: 500,
    statusText: 'Internal Server Error',
    headers: {},
  });
}

async function ganapServer(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const request = `${config.method} ${config.url}`;
  switch (request) {
    case 'get /ganaps/ganap-1':
      return respond(config, server.detail);
    case 'get /ganaps/ganap-1/form-blocks': {
      expect(config.params).toEqual({ scope: 'REGISTRATION' });
      server.formBlockRequests += 1;
      if (server.formBlocks === 'error') throw serverError(config);
      return respond(config, await server.formBlocks);
    }
    default:
      throw new Error(`Unexpected request: ${request}`);
  }
}

function EventDetailsProbe(): null {
  const detail = useGanapDetailQuery('ganap-1');
  probe.result = useGanapAction(detail.data, NOW);
  return null;
}

function result(): UseGanapActionResult {
  if (probe.result === null) throw new Error('Event details are not mounted');
  return probe.result;
}

const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
const originalAdapter: typeof axiosInstance.defaults.adapter = axiosInstance.defaults.adapter;
let root: Root | null = null;

beforeEach((): void => {
  useAuthStore.setState({ token: 'integration-token' });
  axiosInstance.defaults.adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ganapServer(config);
});

afterEach((): void => {
  root?.unmount();
  root = null;
  client.clear();
  axiosInstance.defaults.adapter = originalAdapter;
  useAuthStore.setState({ token: null });
  server.detail = null;
  server.formBlocks = [];
  server.formBlockRequests = 0;
  probe.result = null;
  onlineManager.setOnline(true);
});

async function openEventDetails(): Promise<void> {
  const container: HTMLDivElement = document.createElement('div');
  root = createRoot(container);
  root.render(
    createElement(QueryClientProvider, { client }, createElement(EventDetailsProbe as () => ReactElement | null)),
  );
  await vi.waitFor((): void => expect(result().actionModel).not.toBeNull());
}

describe('Event Details for a pending registration', (): void => {
  it('shows Awaiting approval and Cancel request for an approval-only event without questions', async (): Promise<void> => {
    server.detail = ganapDetail(true, 'PENDING', null);
    server.formBlocks = [];

    await openEventDetails();

    await vi.waitFor((): void =>
      expect(result().actionModel).toEqual({
        statusLabel: 'Awaiting approval',
        primary: {
          action: 'leave',
          label: 'Cancel request',
          confirmation: {
            title: 'Cancel your request?',
            message: 'Your pending registration request will be removed.',
            confirmLabel: 'Cancel request',
          },
        },
        secondary: null,
      }),
    );
    expect(result().isResolving).toBe(false);
    expect(server.formBlockRequests).toBe(1);
  });

  describe.each([
    ['with approval', true],
    ['without approval', false],
  ])('an event %s and registration questions', (_case: string, requiresApproval: boolean): void => {
    it('keeps Complete registration while the form is unanswered', async (): Promise<void> => {
      server.detail = ganapDetail(requiresApproval, 'PENDING', null);
      server.formBlocks = [QUESTION];

      await openEventDetails();

      await vi.waitFor((): void =>
        expect(result().actionModel).toEqual({
          statusLabel: 'Registration incomplete',
          primary: { action: 'complete-registration', label: 'Complete registration', confirmation: null },
          secondary: null,
        }),
      );
      expect(result().isResolving).toBe(false);
    });
  });

  it('shows Awaiting approval after the form was submitted without checking the form', async (): Promise<void> => {
    server.detail = ganapDetail(true, 'PENDING', TIMESTAMP);

    await openEventDetails();

    expect(result().actionModel?.statusLabel).toBe('Awaiting approval');
    expect(result().actionModel?.primary?.label).toBe('Cancel request');
    expect(result().isResolving).toBe(false);
    expect(server.formBlockRequests).toBe(0);
  });

  it('does not check the form for a registered attendee', async (): Promise<void> => {
    server.detail = ganapDetail(false, 'REGISTERED', null);

    await openEventDetails();

    expect(result().actionModel?.statusLabel).toBe('Joined');
    expect(result().isResolving).toBe(false);
    expect(server.formBlockRequests).toBe(0);
  });

  it('falls back to Complete registration when the form check fails', async (): Promise<void> => {
    server.detail = ganapDetail(true, 'PENDING', null);
    server.formBlocks = 'error';

    await openEventDetails();

    await vi.waitFor(
      (): void => {
        expect(result().isResolving).toBe(false);
        expect(result().actionModel?.primary?.label).toBe('Complete registration');
      },
      { timeout: 5000 },
    );
    expect(result().actionModel?.statusLabel).toBe('Registration incomplete');
  });

  it('holds the action while the form check is in flight', async (): Promise<void> => {
    let release: (blocks: FormBlock[]) => void = (): void => {};
    server.detail = ganapDetail(true, 'PENDING', null);
    server.formBlocks = new Promise<FormBlock[]>((resolve: (blocks: FormBlock[]) => void): void => {
      release = resolve;
    });

    await openEventDetails();

    await vi.waitFor((): void => expect(result().isResolving).toBe(true));
    expect(result().actionModel?.primary?.label).not.toBe('Complete registration');
    expect(result().actionModel?.statusLabel).not.toBe('Registration incomplete');

    release([]);

    await vi.waitFor((): void => expect(result().isResolving).toBe(false));
    expect(result().actionModel?.statusLabel).toBe('Awaiting approval');
    expect(result().actionModel?.primary?.label).toBe('Cancel request');
  });

  it('keeps Registration incomplete while checking the form of an event without approval', async (): Promise<void> => {
    let release: (blocks: FormBlock[]) => void = (): void => {};
    server.detail = ganapDetail(false, 'PENDING', null);
    server.formBlocks = new Promise<FormBlock[]>((resolve: (blocks: FormBlock[]) => void): void => {
      release = resolve;
    });

    await openEventDetails();

    await vi.waitFor((): void => expect(result().isResolving).toBe(true));
    expect(result().actionModel?.statusLabel).toBe('Registration incomplete');

    release([QUESTION]);

    await vi.waitFor((): void => expect(result().isResolving).toBe(false));
    expect(result().actionModel?.statusLabel).toBe('Registration incomplete');
    expect(result().actionModel?.primary?.label).toBe('Complete registration');
  });

  it('offers Complete registration while offline and Cancel request once back online', async (): Promise<void> => {
    server.detail = ganapDetail(true, 'PENDING', null);
    server.formBlocks = [];
    await openEventDetails();
    await vi.waitFor((): void => expect(result().actionModel?.primary?.label).toBe('Cancel request'));
    client.removeQueries({ queryKey: ['ganaps', 'detail', 'ganap-1', 'form-blocks'] });
    server.formBlockRequests = 0;
    onlineManager.setOnline(false);
    root?.unmount();

    await openEventDetails();

    await vi.waitFor((): void => expect(result().actionModel?.primary?.label).toBe('Complete registration'));
    expect(result().isResolving).toBe(false);
    expect(server.formBlockRequests).toBe(0);

    onlineManager.setOnline(true);

    await vi.waitFor((): void => expect(result().actionModel?.primary?.label).toBe('Cancel request'));
    expect(result().actionModel?.statusLabel).toBe('Awaiting approval');
  });
});
