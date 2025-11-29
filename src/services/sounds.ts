import sendSoundUrl from '../assets/sounds/send.wav';
import receiveSoundUrl from '../assets/sounds/receive.wav';

// Preload audio objects
const sendAudio = new Audio(sendSoundUrl);
const receiveAudio = new Audio(receiveSoundUrl);

// Set volume
sendAudio.volume = 0.5;
receiveAudio.volume = 0.5;

// Track if audio context is unlocked
let isUnlocked = false;

/**
 * Initialize sound system and unlock audio context on first interaction
 */
export function initSounds() {
  const unlock = () => {
    if (isUnlocked) return;

    // Play silent sound to unlock
    sendAudio
      .play()
      .then(() => {
        sendAudio.pause();
        sendAudio.currentTime = 0;
        isUnlocked = true;
        // Remove listeners
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
      })
      .catch(() => {
        // Expected if no interaction yet, just ignore
      });
  };

  document.addEventListener('click', unlock);
  document.addEventListener('keydown', unlock);
}

/**
 * Play the "message sent" sound
 */
export function playMessageSent() {
  sendAudio.currentTime = 0;
  sendAudio.play().catch((e) => console.error('Error playing sent sound:', e));
}

/**
 * Play the "message received" sound
 */
export function playMessageReceived() {
  receiveAudio.currentTime = 0;
  receiveAudio.play().catch((e) => console.error('Error playing received sound:', e));
}
