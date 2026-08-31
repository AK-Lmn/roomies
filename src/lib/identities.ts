export const ANIMALS = [
  "Penguin",
  "Cat",
  "Fox",
  "Frog",
  "Owl",
  "Bear",
  "Moth",
  "Hare",
  "Crow",
  "Newt",
  "Badger",
  "Sparrow",
  "Toad",
  "Mink",
  "Wren",
  "Seal",
] as const;

export const ADJECTIVES = [
  "Sleepy",
  "Quiet",
  "Midnight",
  "Foggy",
  "Velvet",
  "Copper",
  "Mossy",
  "Lantern",
  "Rainy",
  "Drowsy",
  "Harbor",
  "Ember",
  "Soft",
  "Nested",
  "Dim",
  "Warm",
] as const;

export type Animal = (typeof ANIMALS)[number];

export const ANIMAL_COLORS: Record<Animal, string> = {
  Penguin: "#4A5560",
  Cat: "#C96B4A",
  Fox: "#B85A38",
  Frog: "#6F8F6C",
  Owl: "#7A6248",
  Bear: "#6B5344",
  Moth: "#C4A574",
  Hare: "#A89078",
  Crow: "#3A3530",
  Newt: "#7D9A78",
  Badger: "#5C534C",
  Sparrow: "#8A6A4B",
  Toad: "#6A7A55",
  Mink: "#7A4E3A",
  Wren: "#9A7A58",
  Seal: "#6A7380",
};

export const ROOM_NAMES = [
  "The Lantern Flat",
  "Fourth Floor",
  "Rainy Kitchen",
  "The Green Sofa",
  "Harbor Window",
  "The Quiet Loft",
  "Copper Kettle",
  "Moss Study",
  "The Night Hall",
  "Ember Room",
  "Soft Landing",
  "Nested House",
  "Dim Gallery",
  "Warm Stairwell",
  "Fog Loft",
  "Velvet Corner",
  "The Spare Key",
  "Window Seat",
];

export function pickIdentity(taken: Set<string>): {
  tempIdentity: string;
  animal: Animal;
  color: string;
} {
  const pairs: Array<{ name: string; animal: Animal }> = [];
  for (const adj of ADJECTIVES) {
    for (const animal of ANIMALS) {
      pairs.push({ name: `${adj} ${animal}`, animal });
    }
  }
  for (let i = pairs.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pairs[i];
    pairs[i] = pairs[j];
    pairs[j] = tmp;
  }
  const found = pairs.find((p) => !taken.has(p.name)) ?? {
    name: `Guest ${taken.size + 1}`,
    animal: ANIMALS[taken.size % ANIMALS.length],
  };
  return {
    tempIdentity: found.name,
    animal: found.animal,
    color: ANIMAL_COLORS[found.animal],
  };
}

export function pickRoomName(): string {
  return ROOM_NAMES[Math.floor(Math.random() * ROOM_NAMES.length)] ?? "The Quiet Loft";
}
