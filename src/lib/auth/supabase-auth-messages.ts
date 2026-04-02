/** Map Supabase auth errors to short user-facing codes or friendly text. */

export function friendlySignUpError(message: string): string {
  const m = message.toLowerCase();

  if (
    m.includes("already registered") ||
    m.includes("user already registered") ||
    m.includes("already been registered")
  ) {
    return "Email already in use. Please sign in instead.";
  }
  if (m.includes("already exists") || m.includes("duplicate")) {
    return "Email already in use. Please sign in instead.";
  }
  if (m.includes("password")) {
    return message;
  }
  return "We couldn’t create your account. Please try again or sign in if you already have one.";
}

export function friendlySignInError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Invalid email or password.";
  }
  return message;
}
