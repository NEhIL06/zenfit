import { getVectorStore } from '../lib/ai-trainer/vector-store'
import { Document } from '@langchain/core/documents'

const SEED_KNOWLEDGE_DOCUMENTS = [
  {
    pageContent: `EXERCISE FORM GUIDE: Bench Press Mechanics
Target Muscles: Pectoralis Major, Anterior Deltoids, Triceps Brachii.
Setup: Lie flat on bench with feet planted firm. Grip barbell slightly wider than shoulder width. Retract scapula (squeeze shoulder blades together) and arch upper back slightly.
Execution: Unrack bar over chest. Inhale and lower bar slowly to mid-sternum, elbows angled at 45 degrees relative to torso. Touch chest lightly without bouncing. Exhale and drive bar straight up while driving feet into floor (leg drive).
Safety Rules: Never flare elbows out at 90 degrees to avoid shoulder impingement. Always keep wrists neutral, not bent backwards. Use spotter or safety bars for heavy sets.`,
    metadata: { category: 'exercise_form', exercise: 'bench_press' },
  },
  {
    pageContent: `EXERCISE FORM GUIDE: Barbell Back Squat Mechanics
Target Muscles: Quadriceps, Gluteus Maximus, Hamstrings, Erector Spinae.
Setup: Step under bar, position on upper traps (high bar) or rear delts (low bar). Pull elbows down to create shelf. Unrack bar and take 2-3 steps back. Set stance shoulder-width apart, toes turned slightly out 15-30 degrees.
Execution: Brace core with Valsalva maneuver (deep breath into abdomen). Initiate movement by hinging hips back and bending knees simultaneously. Keep chest up and knees tracking in line with toes. Squat down until hip crease is below top of knees (parallel or deeper). Drive through mid-foot to stand back up.
Safety Rules: Do not allow knees to cave inward (valgus collapse). Maintain neutral spinal alignment throughout rep.`,
    metadata: { category: 'exercise_form', exercise: 'barbell_squat' },
  },
  {
    pageContent: `EXERCISE FORM GUIDE: Conventional Deadlift Mechanics
Target Muscles: Erector Spinae, Gluteus Maximus, Hamstrings, Latissimus Dorsi, Trapezius.
Setup: Stand with feet hip-width apart, barbell over mid-foot (1 inch from shins). Bend at hips to grab bar with double-overhand or mixed grip just outside shins. Push shins forward until touching bar. Pull chest up, pull slack out of bar, and engage lats ("squeeze armpits").
Execution: Inhale deep into stomach and brace core. Push floor away with legs while keeping bar tight to body (dragging up shins and thighs). Lock out hips and knees simultaneously at top without hyperextending lower back. Lower bar under control along same vertical bar path.
Safety Rules: Never round lumbar spine during pull. Keep bar close to center of mass at all times.`,
    metadata: { category: 'exercise_form', exercise: 'deadlift' },
  },
  {
    pageContent: `NUTRITION FUNDAMENTALS: Macro Splits & Energy Balance
1. Energy Balance: Caloric intake vs output determines body mass change.
   - Weight Loss (Cut): Caloric deficit of 300-500 kcal below TDEE (0.5-1 lb loss per week).
   - Muscle Gain (Lean Bulk): Caloric surplus of 200-300 kcal above TDEE.
2. Protein Requirements:
   - Hypertrophy/Strength: 1.6 - 2.2g of protein per kg of bodyweight (0.8 - 1.0g per lb).
   - Fat Loss (Satiety & Muscle Retention): Up to 2.4g per kg of bodyweight.
3. Fats & Carbohydrates:
   - Dietary Fat: Minimum 0.6 - 0.8g per kg for healthy hormone synthesis (testosterone, estrogen).
   - Carbohydrates: Fill remaining calories based on training volume to fuel glycolytic workouts.`,
    metadata: { category: 'nutrition', topic: 'macronutrients' },
  },
  {
    pageContent: `PROGRESSIVE OVERLOAD PRINCIPLES: Sustainable Strength Gains
Progressive overload requires continuously increasing the stress placed on the musculoskeletal system to stimulate adaptation.
Methods of Overload:
1. Load Progression: Increase weight lifted while keeping sets and reps constant (e.g., +2.5kg on compound lifts).
2. Volume Progression: Add reps per set (e.g., 3x8 -> 3x10 -> 3x12) before increasing load.
3. Set Expansion: Increase total sets per muscle group per week (10-20 sets per muscle group per week is optimal).
4. Mechanical Advantage & Tempo: Increase time under tension (TUT) or pause at maximum elongation.
Rest & Recovery: Deload every 4-8 weeks by reducing training volume by 40-50% to clear fatigue.`,
    metadata: { category: 'training_principles', topic: 'progressive_overload' },
  },
  {
    pageContent: `INJURY PREVENTION & RECOVERY PROTOCOLS
1. Warm-Up Protocol: 5-10 minutes general cardiovascular elevation followed by dynamic joint mobility drills (shoulder dislocates, hip openers, cat-cows) and specific warmup sets building to working weight.
2. Sleep & Systemic Recovery: 7-9 hours of quality sleep per night is required for optimal human growth hormone (HGH) secretion and central nervous system (CNS) recovery.
3. Hydration: Drink 35-45ml of water per kg of body weight daily + 500-1000ml extra during intensive training sessions.`,
    metadata: { category: 'recovery', topic: 'injury_prevention' },
  }
]

export async function seedKnowledgeBase() {
  console.log('[Seed Script] Seeding global fitness knowledge base into ChromaDB...')

  try {
    const vectorStore = getVectorStore()
    const langchainDocs = SEED_KNOWLEDGE_DOCUMENTS.map(
      d => new Document({ pageContent: d.pageContent, metadata: d.metadata })
    )

    await vectorStore.addGlobalDocuments(langchainDocs)
    console.log('[Seed Script] Successfully seeded', langchainDocs.length, 'fitness knowledge documents!')
  } catch (error) {
    console.error('[Seed Script] Failed to seed ChromaDB vector store:', error)
  }
}

if (require.main === module || process.argv[1]?.includes('seed-knowledge-base')) {
  seedKnowledgeBase().then(() => process.exit(0))
}
