/** Friendly copy for errors Supabase/Google return on the OAuth redirect. */
export function describeOAuthError(error: string | null, description: string | null): { title: string; message: string } {
  if (error === 'access_denied') {
    return { title: 'Google sign-in was cancelled', message: 'No problem — you can try again, or sign in with your email instead.' };
  }
  if (description && /email/i.test(description)) {
    return { title: "Google sign-in didn't work", message: "We couldn't get an email address from that Google account. Try a different account or sign in with email." };
  }
  if (description && /provider is not enabled|unsupported provider/i.test(description)) {
    return { title: 'Google sign-in is unavailable', message: 'Google sign-in is not set up yet. Please sign in with your email instead.' };
  }
  return { title: "Google sign-in didn't work", message: 'Something went wrong while signing in with Google. Please try again.' };
}
