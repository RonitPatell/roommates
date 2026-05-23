/**
 * Recovery sessions must finish on the reset-password screen before entering the main app.
 */
let recoveryPending = false;

export function setPasswordRecoveryPending(value: boolean) {
  recoveryPending = value;
}

export function isPasswordRecoveryPending(): boolean {
  return recoveryPending;
}
