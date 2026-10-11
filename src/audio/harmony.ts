// Chord progressions (MIDI note voicings) for the generative score. Home key: D.
// Bands are blended by tension in the 'game' mood; other moods use their own palette.

export type Mood = 'menu' | 'game' | 'ending_good' | 'ending_bad';
export type Palette = 'calm' | 'uneasy' | 'dread' | 'menu' | 'good' | 'bad';

export const PROGRESSIONS: Record<Palette, number[][]> = {
  // Consonant minor-9 colours, warm and slow.
  calm: [
    [38, 45, 53, 60, 64],      // Dm9        D A F C E
    [34, 41, 50, 57, 60],      // Bbmaj9     Bb F D A C
    [41, 48, 57, 64, 67],      // Fmaj9      F C A E G
    [43, 50, 58, 65, 69],      // Gm9        G D Bb F A
  ],
  // Added dissonance: minor-major 7ths, b9s, half-diminished, semitone rubs.
  uneasy: [
    [38, 45, 53, 61, 64],      // Dm(maj9)   D A F C# E
    [34, 46, 50, 52, 53],      // Bb(add#11) Bb Bb D E F
    [40, 52, 55, 58, 62],      // Em7b5      E E G Bb D
    [45, 52, 55, 61, 70],      // A7b9       A E G C# Bb
    [43, 50, 58, 63, 67],      // Gm(b6)     G D Bb Eb G
  ],
  // Tritones and clusters — dread.
  dread: [
    [38, 44, 53, 56, 61],      // D  Ab F  Ab C#
    [34, 40, 46, 52, 57],      // Bb E  Bb E  A
    [37, 43, 49, 52, 58],      // C#dim7
    [38, 39, 45, 51, 56],      // D Eb A Eb Ab cluster
    [44, 50, 56, 62, 63],      // Ab D Ab D Eb
  ],
  // Menu: mysterious, floating, unresolved but calm (Dorian / Lydian colours).
  menu: [
    [38, 45, 53, 57, 64],      // Dm(add9)
    [34, 46, 53, 57, 64],      // Bbmaj7#11
    [38, 43, 50, 57, 58],      // Gm(add9)/D
    [36, 43, 50, 55, 62],      // Csus2
  ],
  // Good ending: warm D major resolution.
  good: [
    [38, 45, 54, 61, 64],      // Dmaj9
    [43, 50, 59, 66, 69],      // Gmaj9
    [35, 47, 54, 57, 64],      // Bm11
    [45, 50, 52, 57, 64],      // Asus4(add9)
    [38, 45, 50, 54, 57, 62],  // D
  ],
  // Bad ending: bleak low drone.
  bad: [
    [26, 38, 39, 44, 50],      // D Eb Ab cluster
    [25, 37, 43, 44, 49],      // C# G Ab
  ],
};
