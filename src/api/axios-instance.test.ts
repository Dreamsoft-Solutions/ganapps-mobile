import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: async (key: string, value: string): Promise<void> => {
      store.set(key, value);
    },
    getItemAsync: async (key: string): Promise<string | null> => store.get(key) ?? null,
    deleteItemAsync: async (key: string): Promise<void> => {
      store.delete(key);
    },
  };
});

interface DevFlagGlobal {
  __DEV__: boolean;
}

const devFlag: DevFlagGlobal = globalThis as unknown as DevFlagGlobal;
const originalDev: boolean = devFlag.__DEV__;

const serverErrorBody = {
  success: false,
  statusCode: 422,
  message: 'Email already registered',
  details: { email: 'user@example.com' },
};

/** Loads a fresh axios instance so its interceptors register under the given `__DEV__`. */
function loadAxiosInstance(dev: boolean): AxiosInstance {
  devFlag.__DEV__ = dev;
  let instance: AxiosInstance | undefined;
  jest.isolateModules((): void => {
    instance = (require('./axios-instance') as typeof import('./axios-instance')).axiosInstance;
  });
  if (!instance) throw new Error('axios-instance did not load');
  return instance;
}

/** Replies with the server's success envelope. */
async function okAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  return {
    data: { success: true, statusCode: 200, data: { id: 'ganap-1' }, message: 'Success' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
}

/** Fails the way axios does for a 422, carrying a server error body. */
async function unprocessableAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const response: AxiosResponse = {
    data: serverErrorBody,
    status: 422,
    statusText: 'Unprocessable Entity',
    headers: {},
    config,
  };
  throw new AxiosError('Request failed with status code 422', AxiosError.ERR_BAD_REQUEST, config, null, response);
}

describe('axiosInstance logging', () => {
  let logSpy: jest.SpiedFunction<typeof console.log>;
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach((): void => {
    logSpy = jest.spyOn(console, 'log').mockImplementation((): void => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation((): void => undefined);
  });

  afterEach((): void => {
    devFlag.__DEV__ = originalDev;
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('writes no request, response or error body to the log in a production build', async (): Promise<void> => {
    const instance: AxiosInstance = loadAxiosInstance(false);

    instance.defaults.adapter = okAdapter;
    expect((await instance.get('/ganaps/ganap-1')).data).toEqual({ id: 'ganap-1' });
    instance.defaults.adapter = unprocessableAdapter;
    await expect(instance.post('/auth/register', {})).rejects.toThrow('Email already registered');

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('keeps the [API] request, response and error lines in development', async (): Promise<void> => {
    const instance: AxiosInstance = loadAxiosInstance(true);

    instance.defaults.adapter = okAdapter;
    await instance.get('/ganaps/ganap-1');
    instance.defaults.adapter = unprocessableAdapter;
    await expect(instance.post('/auth/register', {})).rejects.toThrow('Email already registered');

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[API\] GET .*\/ganaps\/ganap-1$/));
    expect(logSpy).toHaveBeenCalledWith('[API] 200 GET /ganaps/ganap-1');
    expect(errorSpy).toHaveBeenCalledWith('[API] 422 POST /auth/register', serverErrorBody);
  });
});
