// Notification service using Tauri's native notification plugin
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

// Track whether notifications are enabled and initialized
let notificationsEnabled = false;
let initialized = false;

/**
 * Initialize the notification system.
 * Checks/requests permission and sets up the notification state.
 * Should be called once when the app starts (after user login).
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

    notificationsEnabled = hasPermission;
    initialized = true;

    if (hasPermission) {
      console.log('Notifications enabled');
    } else {
      console.log('Notifications permission denied');
    }

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
 * Show a notification for a new message
 * @param senderName - The name of the message sender
 * @param messageText - The message content (will be truncated if too long)
 */
export async function notifyNewMessage(senderName: string, messageText: string): Promise<void> {
  if (!notificationsEnabled) {
    return;
  }

  try {
    // Truncate message if too long
    const truncatedMessage =
      messageText.length > 100 ? messageText.substring(0, 97) + '...' : messageText;

    await sendNotification({
      title: `New message from ${senderName}`,
      body: truncatedMessage,
      sound: 'default',
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
    await sendNotification({
      title: 'Contact Online',
      body: `${userName} is now online`,
      sound: 'default',
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
    await sendNotification({
      title: 'Contact Offline',
      body: `${userName} is now offline`,
      sound: 'default',
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
    await sendNotification({ title, body, sound: 'default' });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}
