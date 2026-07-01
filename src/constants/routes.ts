export const Routes = {
  auth: {
    login: '/(auth)/login',
    register: '/(auth)/register',
    forgotPassword: '/(auth)/forgot-password',
  },
  app: {
    home: '/(app)/(home)',
    features: '/(app)/(features)',
    profile: '/(app)/(profile)',
    more: '/(app)/(more)',
  },
  featureDetail: (id: string) => `/(app)/(features)/${id}`,
  homeDetail: (id: string) => `/(app)/(home)/${id}`,
  profileEdit: '/(app)/(profile)/edit',
  profileSettings: '/(app)/(profile)/settings',
} as const;
