// A short two-note chime, made with the Web Audio API (no sound file needed).
// Browsers only allow sound after the user has clicked or typed on the page at
// least once; before that this does nothing.
export function playChime() {
    try {
        const context = new AudioContext();
        const notes = [
            { frequency: 880, start: 0 },
            { frequency: 1174.66, start: 0.18 },
        ];

        for (const note of notes) {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const startAt = context.currentTime + note.start;

            oscillator.type = 'sine';
            oscillator.frequency.value = note.frequency;
            gain.gain.setValueAtTime(0.0001, startAt);
            gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.45);

            oscillator.connect(gain).connect(context.destination);
            oscillator.start(startAt);
            oscillator.stop(startAt + 0.5);
        }

        setTimeout(() => context.close(), 1200);
    } catch {
        // No audio available: the notification itself still shows.
    }
}
