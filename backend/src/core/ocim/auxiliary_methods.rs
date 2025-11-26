use rustc_hash::{FxHashMap, FxHashSet};

use crate::core::ocim::common_data::{GlobalData, LocalData};

/// Shared related types for (a,b) that are non-divergent in at least one context activity.
pub fn get_non_divergent_types(
    a: &String,
    b: &String,
    context_activities: &[String],
    global_data: &GlobalData,
) -> FxHashSet<String> {
    let shared_related: FxHashSet<String> = match (
        global_data.related.get(a),
        global_data.related.get(b),
    ) {
        (Some(rel_a), Some(rel_b)) => rel_a.intersection(rel_b).cloned().collect(),
        _ => FxHashSet::default(),
    };

    shared_related
        .into_iter()
        .filter(|ot| {
            // Python: not all(ot not in related[c] or ot in divergence[c] for c in context)
            !context_activities.iter().all(|c| {
                let in_related = global_data
                    .related
                    .get(c)
                    .map(|rel| rel.contains(ot))
                    .unwrap_or(false);
                let in_div = global_data
                    .divergence
                    .get(c)
                    .map(|div| div.contains(ot))
                    .unwrap_or(false);
                !in_related || in_div
            })
        })
        .collect()
}

/// Shared related types for (a,b) that are divergent across the full context.
pub fn get_divergent_types(
    a: &String,
    b: &String,
    context_activities: &[String],
    global_data: &GlobalData,
) -> FxHashSet<String> {
    let shared_related: FxHashSet<String> = match (
        global_data.related.get(a),
        global_data.related.get(b),
    ) {
        (Some(rel_a), Some(rel_b)) => rel_a.intersection(rel_b).cloned().collect(),
        _ => FxHashSet::default(),
    };

    shared_related
        .into_iter()
        .filter(|ot| {
            context_activities.iter().all(|c| {
                let is_related = global_data
                    .related
                    .get(c)
                    .map(|rel| rel.contains(ot))
                    .unwrap_or(false);
                let is_divergent = global_data
                    .divergence
                    .get(c)
                    .map(|div| div.contains(ot))
                    .unwrap_or(false);
                !is_related || is_divergent
            })
        })
        .collect()
}

/// Projected start activities per object type for a partition part.
/// Derived from the DFG in `LocalData` by restricting to `partition_part`.
pub fn get_projected_start(
    local_data: &LocalData,
    partition_part: &[String],
) -> FxHashMap<String, FxHashSet<String>> {
    projected_boundaries(local_data, partition_part).0
}

/// Projected end activities per object type for a partition part.
/// Derived from the DFG in `LocalData` by restricting to `partition_part`.
pub fn get_projected_end(
    local_data: &LocalData,
    partition_part: &[String],
) -> FxHashMap<String, FxHashSet<String>> {
    projected_boundaries(local_data, partition_part).1
}

fn projected_boundaries(
    local_data: &LocalData,
    partition_part: &[String],
) -> (
    FxHashMap<String, FxHashSet<String>>,
    FxHashMap<String, FxHashSet<String>>,
) {
    let part_set: FxHashSet<_> = partition_part.iter().cloned().collect();
    let mut projected_start: FxHashMap<String, FxHashSet<String>> = FxHashMap::default();
    let mut projected_end: FxHashMap<String, FxHashSet<String>> = FxHashMap::default();

    for ot in &local_data.object_types {
        let (edges, start_map, end_map) = match local_data.dfgs.get(ot) {
            Some(tuple) => tuple,
            None => {
                projected_start.insert(ot.clone(), FxHashSet::default());
                projected_end.insert(ot.clone(), FxHashSet::default());
                continue;
            }
        };

        let mut nodes: FxHashSet<String> = FxHashSet::default();
        for (from, to) in edges.keys() {
            if part_set.contains(from) {
                nodes.insert(from.clone());
            }
            if part_set.contains(to) {
                nodes.insert(to.clone());
            }
        }
        for act in start_map.keys() {
            if part_set.contains(act) {
                nodes.insert(act.clone());
            }
        }
        for act in end_map.keys() {
            if part_set.contains(act) {
                nodes.insert(act.clone());
            }
        }

        if nodes.is_empty() {
            projected_start.insert(ot.clone(), FxHashSet::default());
            projected_end.insert(ot.clone(), FxHashSet::default());
            continue;
        }

        let mut incoming: FxHashSet<String> = FxHashSet::default();
        let mut outgoing: FxHashSet<String> = FxHashSet::default();
        for ((from, to), freq) in edges {
            if *freq == 0 {
                continue;
            }
            if nodes.contains(from) && nodes.contains(to) {
                outgoing.insert(from.clone());
                incoming.insert(to.clone());
            }
        }

        let starts = nodes
            .iter()
            .filter(|node| !incoming.contains(*node))
            .cloned()
            .collect();
        let ends = nodes
            .iter()
            .filter(|node| !outgoing.contains(*node))
            .cloned()
            .collect();

        projected_start.insert(ot.clone(), starts);
        projected_end.insert(ot.clone(), ends);
    }

    (projected_start, projected_end)
}
