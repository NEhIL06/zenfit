"""Parent-Child (Small-to-Big) Chunk Resolver and Deduplication Engine.
Implements Section 3.1 & Section 8e of ZenFit Architecture Specification:
1. Child chunks (64-128 tokens): sharp search needles in ChromaDB dense & sparse indices.
2. Parent chunks (512-1024 tokens): complete kinetic/nutritional protocols in Redis docstore.
3. Deduplication: eliminates duplicate parent IDs to optimize context window token usage.
"""

from typing import List, Dict, Any, Optional
from app.core.logger import logger
from app.services.redis_vss_service import redis_vss_service


# Seed verified clinical parent protocols for exercise science and clinical nutrition
DEFAULT_PARENT_KNOWLEDGE: Dict[str, Dict[str, Any]] = {
    "parent_squat_kinetics": {
        "id": "parent_squat_kinetics",
        "title": "Barbell Squat Biomechanics, Kinetic Chain & Patellofemoral Mechanics",
        "content": (
            "The barbell back squat is a closed-chain multi-joint movement requiring triple extension of hips, knees, and ankles. "
            "Setup: Bar resting across upper trapezius (high bar) or mid-trapezius/posterior deltoid shelf (low bar). "
            "Execution: Initiate movement by simultaneously breaking at hips and knees, maintaining anterior abdominal pressure and neutral lordotic spine. "
            "Depth: Hip crease descending below superior patellar pole. "
            "Patellofemoral Crepitus & Knee Pinch Management: Often caused by restricted ankle dorsiflexion, excessive anterior knee travel without adequate hip hinge, "
            "or weak vastus medialis oblique (VMO) activation. Corrective cue: Widen stance slightly, cue external rotation ('screw feet into floor'), "
            "and elevate heels 0.5-1.0 inch with squat wedges to unload patellofemoral joint contact pressures."
        ),
        "metadata": {
            "source": "NSCA Essentials of Strength Training & Biomechanics",
            "category": "biomechanics",
            "exercise": "squat",
        },
    },
    "parent_serratus_winging": {
        "id": "parent_serratus_winging",
        "title": "Scapular Dyskinesis & Serratus Anterior Activation",
        "content": (
            "Scapular winging (medial or lateral) is biomechanically characterized by the prominence of the medial border or inferior angle of the scapula away from the posterior thoracic wall. "
            "Etiology: Neuropathy of the long thoracic nerve or functional weakness/inhibition of the serratus anterior and lower trapezius muscles. "
            "Contraindications: Heavy overhead military pressing and uncontrolled horizontal bench press without scapular retraction. "
            "Rehabilitation & Corrective Protocol: Serratus punches (supine dynamic protraction), push-up plus on forearms, wall slide shrugs with resistance band, "
            "and prone Y/T/W raises to restore scapulohumeral rhythm and glenohumeral stability."
        ),
        "metadata": {
            "source": "Journal of Orthopaedic & Sports Physical Therapy (JOSPT)",
            "category": "corrective_exercise",
            "anatomy": "serratus anterior",
        },
    },
    "parent_hypertrophy_principles": {
        "id": "parent_hypertrophy_principles",
        "title": "Mechanotransduction, Progressive Overload & Hypertrophy Periodization",
        "content": (
            "Muscular hypertrophy is primarily mediated by mechanical tension, muscle damage, and metabolic stress, with mechanical tension being the primary driver. "
            "Progressive Overload: Systematically increasing external load, repetition volume, or total time-under-tension while preserving technical execution. "
            "Volume Benchmarks: 10 to 20 hard working sets per muscle group weekly at RPE 7-9 (1-3 repetitions in reserve). "
            "Rest Intervals: 2 to 3 minutes for compound multi-joint movements (squat, bench press, deadlift, row) allows phosphocreatine resynthesis and higher total volume load."
        ),
        "metadata": {
            "source": "Schoenfeld BJ, Science and Development of Muscle Hypertrophy",
            "category": "hypertrophy",
        },
    },
    "parent_clinical_nutrition": {
        "id": "parent_clinical_nutrition",
        "title": "Clinical Sports Nutrition, Protein Kinetics & Energy Balance",
        "content": (
            "Energy Balance & Body Recomposition: Hypercaloric surplus (+250 to +400 kcal/day) optimizes muscle protein synthesis (MPS) for lean mass accretion. "
            "Hypocaloric deficit (-300 to -500 kcal/day) yields steady adipose loss of 0.5% to 1.0% body weight weekly while minimizing lean tissue catabolism. "
            "Protein Requirements: 1.6 to 2.2 grams per kilogram of total body mass distributed across 4 to 5 boluses containing >= 3g leucine each. "
            "Hydration & Electrolytes: 35-45 ml/kg fluid intake with sodium replenishment (500-1000mg/hour in heavy sweating conditions)."
        ),
        "metadata": {
            "source": "International Society of Sports Nutrition (ISSN) Position Stand",
            "category": "nutrition",
        },
    },
}


class ParentChildResolver:
    """Hydrates and deduplicates child candidate chunks into full parent knowledge blocks."""

    def __init__(self):
        # Pre-seed default parent documents into Redis VSS docstore
        for pid, pdoc in DEFAULT_PARENT_KNOWLEDGE.items():
            redis_vss_service.set_parent_document(pid, pdoc)

    def hydrate_parent(self, child_or_parent: Dict[str, Any]) -> Dict[str, Any]:
        """Hydrates a single chunk into its parent document if parent_id exists."""
        meta = child_or_parent.get("metadata") or child_or_parent.get("meta", {})
        parent_id = meta.get("parent_id") or child_or_parent.get("parent_id") or child_or_parent.get("id")

        if parent_id:
            parent_doc = redis_vss_service.get_parent_document(parent_id)
            if not parent_doc and parent_id in DEFAULT_PARENT_KNOWLEDGE:
                parent_doc = DEFAULT_PARENT_KNOWLEDGE[parent_id]
                redis_vss_service.set_parent_document(parent_id, parent_doc)

            if parent_doc:
                merged = dict(child_or_parent)
                merged["id"] = parent_id
                merged["content"] = parent_doc.get("content", child_or_parent.get("content", ""))
                merged["text"] = merged["content"]
                merged_meta = dict(parent_doc.get("metadata", {}))
                merged_meta.update(meta)
                merged["metadata"] = merged_meta
                return merged

        return child_or_parent

    def resolve_and_deduplicate(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Resolves child candidates into parents and eliminates duplicates by parent_id."""
        seen_parents = set()
        resolved: List[Dict[str, Any]] = []

        for c in candidates:
            hydrated = self.hydrate_parent(c)
            parent_key = hydrated.get("id") or hydrated.get("content", "")[:60]

            if parent_key not in seen_parents:
                seen_parents.add(parent_key)
                resolved.append(hydrated)

        return resolved


# Singleton instance
parent_child_resolver = ParentChildResolver()
