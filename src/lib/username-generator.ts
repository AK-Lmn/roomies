const ADJECTIVES = [
  "sleepy",
  "cozy",
  "misty",
  "velvet",
  "amber",
  "copper",
  "quiet",
  "mossy",
  "golden",
  "gentle",
  "rainy",
  "drowsy",
  "soft",
  "autumn",
  "dim",
  "harbor",
  "ember",
  "nested",
  "calm",
  "warm",
  "rustic",
  "hazel",
];

const NOUNS = [
  "bear",
  "fox",
  "cat",
  "owl",
  "deer",
  "rabbit",
  "badger",
  "sparrow",
  "otter",
  "robin",
  "lantern",
  "kettle",
  "loft",
  "acorn",
  "hazel",
  "willow",
];

export function generateRandomUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${adj}_${noun}_${num}`;
}
