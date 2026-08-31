export interface AnimalAvatarChoice {
  id: string;
  name: string;
  animal: "Bear" | "Fox" | "Cat" | "Owl" | "Deer" | "Rabbit";
  color: string;
  avatarUrl: string;
}

export const ANIMAL_AVATAR_CHOICES: AnimalAvatarChoice[] = [
  {
    id: "bear",
    name: "Bear",
    animal: "Bear",
    color: "#c2905a",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Bear&backgroundColor=c2905a&radius=50",
  },
  {
    id: "fox",
    name: "Fox",
    animal: "Fox",
    color: "#ea580c",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Fox&backgroundColor=ea580c&radius=50",
  },
  {
    id: "cat",
    name: "Cat",
    animal: "Cat",
    color: "#0d9488",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Cat&backgroundColor=0d9488&radius=50",
  },
  {
    id: "owl",
    name: "Owl",
    animal: "Owl",
    color: "#6366f1",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Owl&backgroundColor=6366f1&radius=50",
  },
  {
    id: "deer",
    name: "Deer",
    animal: "Deer",
    color: "#059669",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Deer&backgroundColor=059669&radius=50",
  },
  {
    id: "rabbit",
    name: "Rabbit",
    animal: "Rabbit",
    color: "#db2777",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Rabbit&backgroundColor=db2777&radius=50",
  },
];

export function getAvatarChoiceByUrl(url: string | null | undefined): AnimalAvatarChoice {
  if (!url) return ANIMAL_AVATAR_CHOICES[0];
  return ANIMAL_AVATAR_CHOICES.find((c) => c.avatarUrl === url) ?? ANIMAL_AVATAR_CHOICES[0];
}
