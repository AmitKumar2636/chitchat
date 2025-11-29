// Notification service using Tauri's native notification plugin
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

// Track whether notifications are enabled and initialized
let notificationsEnabled = false;
let initialized = false;

// Notification counter for unique IDs (must be 32-bit integer)
let notificationIdCounter = 1;

/**
 * Initialize the notification system.
 * Checks/requests permission and sets up the notification state.
 * Should be called once when the app starts (after user login).
 *
 * Note: Notification channels are an Android-specific feature and are not
 * supported on desktop platforms (Windows, macOS, Linux).
 */
export async function initNotifications(): Promise<boolean> {
  if (initialized) {
    return notificationsEnabled;
  }

  try {
    // Check if we already have permission
    let hasPermission = await isPermissionGranted();

    // Request permission if not granted
    if (!hasPermission) {
      const permission = await requestPermission();
      hasPermission = permission === 'granted';
    }

    if (!hasPermission) {
      console.warn('Notifications permission denied');
    }

    notificationsEnabled = hasPermission;
    initialized = true;

    return hasPermission;
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
    initialized = true;
    notificationsEnabled = false;
    return false;
  }
}

/**
 * Check if notifications are currently enabled
 */
export function areNotificationsEnabled(): boolean {
  return notificationsEnabled;
}

/**
 * Reset notification state (call on logout)
 */
export function resetNotifications(): void {
  initialized = false;
  notificationsEnabled = false;
}

/**
 * Get unique notification ID
 */
function getNotificationId(): number {
  return notificationIdCounter++;
}

/**
 * Generate a deterministic 32-bit integer ID from a string
 */
function getNotificationIdForChat(chatId: string): number {
  let hash = 0;
  for (let i = 0; i < chatId.length; i++) {
    const char = chatId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash | 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Show a notification for a new message
 * @param chatId - The ID of the chat (used for grouping notifications)
 * @param senderName - The name of the message sender
 * @param messageText - The message content (will be truncated if too long)
 */
export async function notifyNewMessage(
  chatId: string,
  senderName: string,
  messageText: string
): Promise<void> {
  if (!notificationsEnabled) {
    return;
  }

  try {
    // Truncate message if too long
    const truncatedMessage =
      messageText.length > 100 ? messageText.substring(0, 97) + '...' : messageText;

    // Send notification with deterministic ID based on chat
    // This ensures updates to the same chat replace the previous notification
    sendNotification({
      id: getNotificationIdForChat(chatId),
      title: `New message from ${senderName}`,
      body: truncatedMessage,
      sound: 'Default',
    });
  } catch (error) {
    console.error('Failed to send message notification:', error);
  }
}

/**
 * Show a notification when a user comes online
 * @param userName - The name of the user who came online
 */
export async function notifyUserOnline(userName: string): Promise<void> {
  if (!notificationsEnabled) {
    return;
  }

  try {
    sendNotification({
      id: getNotificationId(),
      title: 'Contact Online',
      body: `${userName} is now online`,
      sound: 'Default',
    });
  } catch (error) {
    console.error('Failed to send online notification:', error);
  }
}

/**
 * Show a notification when a user goes offline
 * @param userName - The name of the user who went offline
 */
export async function notifyUserOffline(userName: string): Promise<void> {
  if (!notificationsEnabled) {
    return;
  }

  try {
    sendNotification({
      id: getNotificationId(),
      title: 'Contact Offline',
      body: `${userName} is now offline`,
      sound: 'Default',
    });
  } catch (error) {
    console.error('Failed to send offline notification:', error);
  }
}

/**
 * Show a generic notification
 * @param title - Notification title
 * @param body - Notification body text
 */
export async function showNotification(title: string, body: string): Promise<void> {
  if (!notificationsEnabled) {
    return;
  }

  try {
    sendNotification({
      id: getNotificationId(),
      title,
      body,
      sound: 'Default',
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}
