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
    name: "Cozy Bear",
    animal: "Bear",
    color: "#c2905a",
    avatarUrl: "https://api.dicebear.com/9.x/bottts/svg?seed=CozyBear&backgroundColor=c2905a",
  },
  {
    id: "fox",
    name: "Gentle Fox",
    animal: "Fox",
    color: "#ea580c",
    avatarUrl: "https://api.dicebear.com/9.x/bottts/svg?seed=AutumnFox&backgroundColor=ea580c",
  },
  {
    id: "cat",
    name: "Playful Cat",
    animal: "Cat",
    color: "#0d9488",
    avatarUrl: "https://api.dicebear.com/9.x/bottts/svg?seed=MistyCat&backgroundColor=0d9488",
  },
  {
    id: "owl",
    name: "Wise Owl",
    animal: "Owl",
    color: "#6366f1",
    avatarUrl: "https://api.dicebear.com/9.x/bottts/svg?seed=NightOwl&backgroundColor=6366f1",
  },
  {
    id: "deer",
    name: "Calm Deer",
    animal: "Deer",
    color: "#059669",
    avatarUrl: "https://api.dicebear.com/9.x/bottts/svg?seed=ForestDeer&backgroundColor=059669",
  },
  {
    id: "rabbit",
    name: "Warm Rabbit",
    animal: "Rabbit",
    color: "#db2777",
    avatarUrl: "https://api.dicebear.com/9.x/bottts/svg?seed=WarmRabbit&backgroundColor=db2777",
  },
];

export function getAvatarChoiceByUrl(url: string | null | undefined): AnimalAvatarChoice {
  if (!url) return ANIMAL_AVATAR_CHOICES[0];
  return ANIMAL_AVATAR_CHOICES.find((c) => c.avatarUrl === url) ?? ANIMAL_AVATAR_CHOICES[0];
}
