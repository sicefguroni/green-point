/** Minimum length for new passwords (signup). */
export const PASSWORD_MIN_LENGTH = 12;

const HAS_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

type RuleState = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
};

function evaluateRules(password: string): RuleState {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: HAS_SPECIAL.test(password),
  };
}

export function passwordMeetsPolicy(password: string): boolean {
  return Object.values(evaluateRules(password)).every(Boolean);
}

/** Short hint shown while the user types (no full checklist). */
export const PASSWORD_HINT_SHORT = `Use ${PASSWORD_MIN_LENGTH}+ characters with upper & lower case, a number, and a symbol.`;

/** Full criteria for assistive technology only (visually hidden in the form). */
export const PASSWORD_POLICY_SR_NOTE = `Password requirements: at least ${PASSWORD_MIN_LENGTH} characters; include uppercase A–Z, lowercase a–z, at least one digit 0–9, and at least one symbol such as ! @ # $ % ^ & * ( ) _ + - = [ ] { } ; ' : " \\ | , . < > / ? or ~.`;
