import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '608264916714-vlfouvrs39a76484bpu38nveiut8m18n.apps.googleusercontent.com',
  });

  const signIn = async (): Promise<string | null> => {
    const result = await promptAsync();
    if (result.type === 'success') {
      return result.authentication?.accessToken ?? null;
    }
    return null;
  };

  return { signIn, request };
};