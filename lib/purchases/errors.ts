import { PurchasesError, PURCHASES_ERROR_CODE } from 'react-native-purchases';

export function isPurchaseCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as unknown as PurchasesError).code;
  return (
    code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    (error as { userCancelled?: boolean }).userCancelled === true
  );
}

export function purchaseErrorMessage(error: unknown): string {
  if (isPurchaseCancelled(error)) {
    return 'Purchase cancelled.';
  }

  if (error instanceof Error) {
    const rc = error as unknown as PurchasesError;
    switch (rc.code) {
      case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
        return 'The App Store or Play Store is unavailable. Try again later.';
      case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
        return 'Purchases are not allowed on this device.';
      case PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR:
        return 'This purchase could not be completed.';
      case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
        return 'This plan is not available yet. Check your RevenueCat offering.';
      case PURCHASES_ERROR_CODE.NETWORK_ERROR:
        return 'Network error. Check your connection and try again.';
      case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
        return 'This subscription is already linked to another account.';
      default:
        return rc.message || 'Something went wrong. Please try again.';
    }
  }

  return 'Something went wrong. Please try again.';
}
