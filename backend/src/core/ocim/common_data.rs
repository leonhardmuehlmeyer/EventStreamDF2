use rustc_hash::{FxHashMap, FxHashSet};
use process_mining::OCEL;
use crate::models::dfg::OCDirectlyFollowsGraph;
pub use process_mining::ocel::linked_ocel::index_linked_ocel::IndexLinkedOCEL;

use crate::models::ocel::OCELUtils;

#[derive(Debug, Clone)]
pub struct LocalData {
    pub oc_log_list: Vec<OCEL>,                // one per object type
    pub alphabet: Vec<String>,           // Σ
    pub object_types: FxHashSet<String>,       // types in current sublog
    pub object_set: FxHashSet<String>,         // objects in current sublog
    pub expected_objects: FxHashSet<String>,   // optionally narrowed
    pub dfgs: FxHashMap<String, (FxHashMap<(String, String), u32>, FxHashMap<String, u32>, FxHashMap<String, u32>)>, // direct-follows graph per object type
    pub clos: FxHashMap<String, FxHashSet<(String, String)>>, // transitive closure per object type
}

#[derive(Debug, Clone)]
pub struct GlobalData {
    pub oc_log_list: Vec<OCEL>,
    // everything as: object type -> set of activities
    pub divergence: FxHashMap<String, FxHashSet<String>>,
    pub convergence: FxHashMap<String, FxHashSet<String>>,
    pub related: FxHashMap<String, FxHashSet<String>>,
    pub deficiency: FxHashMap<String, FxHashSet<String>>,
    // pub runtime_info: FxHashMap<String, Vec<f64>>,
    // pub quality_info: FxHashMap<String, Vec<f64>>,
}

impl LocalData {
    pub fn new(oc_log_list: Vec<OCEL>, expected_objects: Option<FxHashSet<String>>) -> Self {
        use crate::core::ocim::follows_relations::OCGraphRelations;

        let alphabet = oc_log_list.iter()
            .flat_map(|log| &log.event_types)
            .map(|et| et.name.clone())
            .collect();

        let object_types = oc_log_list.iter()
            .flat_map(|log| &log.object_types)
            .map(|et| et.name.clone())
            .collect();

        let object_set: FxHashSet<String> = oc_log_list.iter()
            .flat_map(|log| log.objects.clone())
            .map(|obj| obj.id.clone())
            .collect();


        let merged_ocels = oc_log_list[0].clone(); // Placeholder for merging OCELs
        let linked_ocel = IndexLinkedOCEL::from_ocel(merged_ocels);

        let ocdfg = OCDirectlyFollowsGraph::create_from_locel(&linked_ocel);

        let expected_objects = expected_objects.unwrap_or_else(|| object_set.clone());
        let dfgs = OCGraphRelations::get_cummulative_directly_follows_relation(&ocdfg);
        let clos = OCGraphRelations::get_transitive_closure_follows_relation(&ocdfg);

        Self { oc_log_list, alphabet, object_types, object_set, expected_objects, dfgs, clos }
    }
}

impl GlobalData {
    pub fn new(oc_log_list: Vec<OCEL>) -> Self {
        let (div, con, rel, defi) = oc_log_list[0].get_interaction_patterns();
        Self {
            oc_log_list,
            divergence: div,
            convergence: con,
            related: rel,
            deficiency: defi,
        }
    }
}
