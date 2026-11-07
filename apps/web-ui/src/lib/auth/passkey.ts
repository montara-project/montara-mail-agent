import { throwAxiosError } from '../api/axios-error'
import { services } from '../api/services'
import { storeSignIn } from './email-auth'

/** The browser speaks the JSON form of WebAuthn (Chrome 129, Safari 18, Firefox 119). */
export const passkeysSupported = () =>
  typeof window !== 'undefined' &&
  typeof window.PublicKeyCredential?.parseRequestOptionsFromJSON === 'function'

/** The user closed the browser's passkey sheet; nothing to report. */
export const passkeyCancelled = (error: unknown) =>
  error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')

/** Sign in with any passkey the browser holds for this site, then store the tokens. */
export async function signInWithPasskey() {
  const { data } = await services.auth.passkeyOptions()
  const credential = (await navigator.credentials.get({
    publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(data.publicKey),
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('No passkey was chosen.')
  try {
    const res = await services.auth.passkeySignIn(credential.toJSON() as AuthenticationResponseJSON)
    storeSignIn(res.data)
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 401) {
      throw new Error("That passkey isn't registered on this server.")
    }
    throwAxiosError(error as Error)
  }
}

/** Make a passkey on this device for the signed-in user and register it under name. */
export async function createPasskey(name: string, password: string) {
  const res = await services.passkeys.options(password)
  const credential = (await navigator.credentials.create({
    publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(res.data.data.publicKey),
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('No passkey was made.')
  return services.passkeys.store({
    name,
    credential: credential.toJSON() as RegistrationResponseJSON,
  })
}
