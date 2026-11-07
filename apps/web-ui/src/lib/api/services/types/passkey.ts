import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'

export type PasskeyResources = {
  list: () => Promise<AxiosListResponse<Models.Passkey>>
  /**
   * The options for navigator.credentials.create, valid for a few minutes,
   * once the password is confirmed (empty for an account without one).
   */
  options: (
    password: string
  ) => Promise<AxiosItemResponse<{ publicKey: PublicKeyCredentialCreationOptionsJSON }>>
  store: (body: {
    name: string
    credential: RegistrationResponseJSON
  }) => Promise<AxiosItemResponse<Models.Passkey>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
}
