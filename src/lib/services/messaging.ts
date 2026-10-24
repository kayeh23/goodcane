import { AppError } from "../service";
import type { DB, Reminder } from "../types";
import { confirmationText, orderToBusinessLink, reminderText, waLink } from "../whatsapp";

/**
 * Validates a Ghana phone number and returns a friendly error message if invalid.
 */
export function validateGhanaPhoneNumber(phone: string): { valid: boolean; error?: string; formatted?: string } {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return { valid: false, error: "Please enter your phone number." };
  }

  // Local Ghana numbers: 10 digits starting with 0
  if (digits.startsWith("0") && digits.length === 10) {
    return { valid: true, formatted: digits };
  }

  // International format: 233 followed by 9 digits (12 digits total)
  if (digits.startsWith("233") && digits.length === 12) {
    return { valid: true, formatted: `0${digits.slice(3)}` };
  }

  return {
    valid: false,
    error: "Please enter a valid 10-digit Ghana phone number (e.g., 024 123 4567 or 020 000 0001).",
  };
}

/**
 * Logs that staff clicked 'Open in WhatsApp' for a draft reminder.
 * Transitions reminder status from 'approved' to 'opened_whatsapp' and records timestamp.
 */
export function markReminderAsOpenedInWhatsApp(
  db: DB,
  reminderId: string,
  now = new Date()
): Reminder {
  const reminder = db.reminders.find((r) => r.id === reminderId);
  if (!reminder) {
    throw new AppError("Reminder not found.", 404);
  }

  const customer = db.customers.find((c) => c.id === reminder.customerId);
  if (reminder.status !== "approved" && reminder.status !== "opened_whatsapp") {
    throw new AppError("Approve the reminder before opening it in WhatsApp.", 409);
  }

  if (customer && !customer.remindersOptIn) {
    throw new AppError("Customer has opted out of reminders.", 409);
  }

  reminder.status = "opened_whatsapp";
  reminder.openedAt = now.toISOString();

  return reminder;
}

export { confirmationText, orderToBusinessLink, reminderText, waLink };
