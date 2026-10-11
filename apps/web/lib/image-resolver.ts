/**
 * Smart dynamic image resolver providing topic-relevant, high-resolution Unsplash images
 * for exercises and meal dishes when AI model inference times out or fails.
 */

const MEAL_IMAGE_MAP: Array<{ keywords: string[]; url: string }> = [
  {
    keywords: ["yogurt", "berry", "chia", "parfait", "berries"],
    url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["curry", "lentil", "rice", "dal", "chickpea", "indian"],
    url: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["chicken", "poultry", "turkey", "breast", "roast"],
    url: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["salmon", "fish", "seafood", "tuna", "trout", "cod"],
    url: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["oatmeal", "oats", "porridge", "breakfast bowl"],
    url: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["shake", "smoothie", "protein shake", "whey"],
    url: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["egg", "omelet", "scramble", "poached"],
    url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["steak", "beef", "meat", "sirloin", "tenderloin"],
    url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["salad", "greens", "spinach", "kale", "veggie", "vegetable"],
    url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["avocado", "toast", "guacamole"],
    url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80",
  },
]

const EXERCISE_IMAGE_MAP: Array<{ keywords: string[]; url: string }> = [
  {
    keywords: ["squat", "leg press", "goblet", "quad"],
    url: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["bench", "press", "push-up", "pushup", "chest", "dips"],
    url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["row", "pull-up", "pullup", "lat", "back", "pulldown"],
    url: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["lunge", "step-up", "split squat", "calves"],
    url: "https://images.unsplash.com/photo-1434682881908-b43d0467b798?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["plank", "core", "abs", "crunch", "russian twist"],
    url: "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["curl", "bicep", "tricep", "arm", "hammer"],
    url: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["deadlift", "hamstring", "hip thrust", "glute"],
    url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80",
  },
  {
    keywords: ["shoulder", "overhead", "overhead press", "lateral raise"],
    url: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80",
  },
]

const DEFAULT_MEAL_URL = "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80"
const DEFAULT_EXERCISE_URL = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80"

export function getCuratedImageUrl(name: string, type: "exercise" | "meal"): string {
  const lower = (name || "").toLowerCase()

  const map = type === "meal" ? MEAL_IMAGE_MAP : EXERCISE_IMAGE_MAP
  const defaultUrl = type === "meal" ? DEFAULT_MEAL_URL : DEFAULT_EXERCISE_URL

  for (const entry of map) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.url
    }
  }

  return defaultUrl
}
