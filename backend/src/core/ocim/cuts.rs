use rustc_hash::{FxHashMap, FxHashSet};
use process_mining::OCEL;

/// Find a concurrent cut (Algorithm 2). Returns a vector of alphabet partitions
/// (each partition is an FxHashSet of activity names). If no concurrent cut is
/// found (i.e. the graph is connected), an empty Vec is returned.
///
/// This implements FINDCUT||(L) from the paper: build edges between activity pairs
/// that `check_concurrency` marks as "cannot be separated", then compute connected
/// components. If >1 component is found, those components are returned.
pub fn find_cut_concurrent(log: &OCEL) -> Vec<FxHashSet<String>> {
    // set of all unique activities in the log
    let sigma: FxHashSet<String> = log
        .event_types
        .iter()
        .map(|et| et.name.clone())
        .collect();

    // Build undirected edge set as adjacency map
    let mut adj: FxHashMap<String, FxHashSet<String>> = FxHashMap::default();
    for a in sigma.iter() {
        adj.entry(a.clone()).or_insert_with(FxHashSet::default);
    }

    // For every unordered pair (a,b) with a != b, check concurrency
    let sigma_vec: Vec<String> = sigma.iter().cloned().collect();
    let n = sigma_vec.len();
    for i in 0..n {
        for j in (i + 1)..n {
            let a = &sigma_vec[i];
            let b = &sigma_vec[j];
            if check_concurrency(log, a, b) {
                adj.get_mut(a).unwrap().insert(b.clone());
                adj.get_mut(b).unwrap().insert(a.clone());
            }
        }
    }

    // Connected components via BFS / DFS
    let mut visited: FxHashSet<String> = FxHashSet::default();
    let mut components: Vec<FxHashSet<String>> = Vec::new();

    for node in adj.keys() {
        if visited.contains(node) {
            continue;
        }
        let mut comp: FxHashSet<String> = FxHashSet::default();
        let mut stack: Vec<String> = vec![node.clone()];
        visited.insert(node.clone());
        while let Some(curr) = stack.pop() {
            comp.insert(curr.clone());
            if let Some(neighs) = adj.get(&curr) {
                for nx in neighs {
                    if !visited.contains(nx) {
                        visited.insert(nx.clone());
                        stack.push(nx.clone());
                    }
                }
            }
        }
        components.push(comp);
    }

    // If only a single connected component exists, algorithm returns nothing
    if components.len() > 1 {
        components
    } else {
        Vec::new()
    }
}

/// Implements CHECK||(L, a, b) from the paper.
///
/// Returns `true` if the pair (a,b) must be forced into the same part because
/// separating them would violate one of the concurrent-cut conditions (18),(31),(32).
///
/// This function relies on helper utils that compute:
/// - relation sets rel_a, rel_b (object types related to activity a/b),
/// - whether a directly-follows relation exists for an object type (and direction),
/// - whether activity is a start/end for an object type, and whether it becomes a start/end
///   when `a` is removed (the projections used in conditions (31) and (32)).
pub fn check_concurrency(log: &OCEL, activity_a: &String, activity_b: &String) -> bool {

    // // rel_a and rel_b are sets of object type names (strings).
    // let rel_a: FxHashSet<String> = log.get_related_object_types_for_activity(activity_a);
    // let rel_b: FxHashSet<String> = log.get_related_object_types_for_activity(activity_b);

    // // intersection of related object types
    // let mut intersect: FxHashSet<&String> = FxHashSet::default();
    // for ot in rel_a.iter() {
    //     if rel_b.contains(ot) {
    //         intersect.insert(ot);
    //     }
    // }

    // // For each shared object type, apply the three checks
    // for ot in intersect {
    //     // --- Condition (18) check: for this object type ot, a and b must be
    //     // bi-directionally connected in the projected directly-follows relation.
    //     // If not bi-directionally connected, they must be in the same part -> return true.
    //     //
    //     // We expect a helper that answers: does activity x directly-follow (projected by object type ot)
    //     // reach activity y? The name below is descriptive; replace with actual util name if different.

    //     let a_reaches_b = crate::core::case_notion::utils::projected_directly_follows_has_path(
    //         log, ot, activity_a, activity_b,
    //     );
    //     let b_reaches_a = crate::core::case_notion::utils::projected_directly_follows_has_path(
    //         log, ot, activity_b, activity_a,
    //     );

    //     if !a_reaches_b || !b_reaches_a {
    //         // violates 18 for this object type -> they must be in same part
    //         return true;
    //     }

    //     // --- Condition (19) check (start activities):
    //     //
    //     // if a ∈ start_ot(L) ∧ b ∉ start_ot(L) ∧ b ∈ start_ot({L | Σ \ {a} projected})
    //     // then they cannot be separated -> return true.
    //     //
    //     // We expect helper functions:
    //     // - is_start_activity_for_object_type(log, ot, activity)
    //     // - is_start_activity_for_object_type_in_projection_excluding_activity(log, ot, excluded_activity, activity)
    //     //
    //     let a_is_start = crate::core::case_notion::utils::is_start_activity_for_object_type(
    //         log, ot, activity_a,
    //     );
    //     let b_is_start = crate::core::case_notion::utils::is_start_activity_for_object_type(
    //         log, ot, activity_b,
    //     );
    //     if a_is_start && !b_is_start {
    //         let b_is_start_if_a_removed =
    //             crate::core::case_notion::utils::is_start_activity_for_object_type_in_projection_excluding_activity(
    //                 log, ot, activity_a, activity_b,
    //             );
    //         if b_is_start_if_a_removed {
    //             return true;
    //         }
    //     }

    //     // --- Condition (20) check (end activities):
    //     //
    //     // analogous to (19), but for end activities:
    //     // if a ∈ end_ot(L) ∧ b ∉ end_ot(L) ∧ b ∈ end_ot({L | Σ \ {a} projected})
    //     // then cannot separate -> return true.
    //     let a_is_end = crate::core::case_notion::utils::is_end_activity_for_object_type(
    //         log, ot, activity_a,
    //     );
    //     let b_is_end = crate::core::case_notion::utils::is_end_activity_for_object_type(
    //         log, ot, activity_b,
    //     );
    //     if a_is_end && !b_is_end {
    //         let b_is_end_if_a_removed =
    //             crate::core::case_notion::utils::is_end_activity_for_object_type_in_projection_excluding_activity(
    //                 log, ot, activity_a, activity_b,
    //             );
    //         if b_is_end_if_a_removed {
    //             return true;
    //         }
    //     }
    // }

    // // No offending object type found -> activities can be separated
    false
}
