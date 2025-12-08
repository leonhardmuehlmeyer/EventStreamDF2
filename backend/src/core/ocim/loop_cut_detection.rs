use std::collections::HashMap;

use petgraph::unionfind::UnionFind;
use rustc_hash::FxHashSet;

use crate::core::ocim::auxiliary_methods::{get_divergent_types, get_non_divergent_types};
use crate::core::ocim::common_data::{GlobalData, LocalData};
use crate::core::ocim::loop_cut::is_loop_cut_valid;
use crate::models::ocpt::OCPTOperatorType;

/// Port of the Python `check_loop` helper.
pub fn check_loop(local_data: &LocalData, global_data: &GlobalData, a: &String, b: &String) -> bool {
    let shared_related: FxHashSet<String> = match (global_data.related.get(a), global_data.related.get(b)) {
        (Some(rel_a), Some(rel_b)) => rel_a.intersection(rel_b).cloned().collect(),
        _ => FxHashSet::default(),
    };

    // Divergent set over the full alphabet (matches Python call).
    let divergent = get_divergent_types(a, b, &local_data.alphabet, global_data);

    for ot in shared_related {
        let Some((dfg, starts, ends)) = local_data.dfgs.get(&ot) else {
            continue;
        };

        let ab_missing = dfg.get(&(a.clone(), b.clone())).copied().unwrap_or(0) == 0;
        let ba_missing = dfg.get(&(b.clone(), a.clone())).copied().unwrap_or(0) == 0;
        if ab_missing || (ba_missing && !divergent.contains(&ot)) {
            return true;
        }

        let a_is_boundary = starts.get(a).copied().unwrap_or(0) > 0 || ends.get(a).copied().unwrap_or(0) > 0;
        let b_is_boundary = starts.get(b).copied().unwrap_or(0) > 0 || ends.get(b).copied().unwrap_or(0) > 0;
        if a_is_boundary && b_is_boundary {
            return true;
        }

        let ab_exists = dfg.get(&(a.clone(), b.clone())).copied().unwrap_or(0) > 0;
        if ab_exists
            && ends.get(a).copied().unwrap_or(0) == 0
            && starts.get(b).copied().unwrap_or(0) == 0
            && !divergent.contains(&ot)
        {
            return true;
        }
    }

    false
}

/// Build connected components of the alphabet using an undirected predicate.
fn connected_partitions(
    alphabet: &[String],
    predicate: impl Fn(usize, usize) -> bool,
) -> Vec<Vec<String>> {
    let n = alphabet.len();
    let mut uf = UnionFind::new(n);
    for i in 0..n {
        for j in (i + 1)..n {
            if predicate(i, j) {
                uf.union(i, j);
            }
        }
    }

    let mut comp_map: HashMap<usize, Vec<String>> = HashMap::new();
    for i in 0..n {
        let root = uf.find(i);
        comp_map.entry(root).or_default().push(alphabet[i].clone());
    }
    comp_map.into_values().collect()
}

/// Rust port of the Python `find_cut_loop` detection routine.
pub fn find_cut_loop(
    local_data: &LocalData,
    global_data: &GlobalData,
) -> Option<(Vec<Vec<String>>, OCPTOperatorType)> {
    // Early rejection: all non-divergent types must have bi-directional closure across every pair.
    for a in &local_data.alphabet {
        for b in &local_data.alphabet {
            for ot in get_non_divergent_types(a, b, &local_data.alphabet, global_data) {
                let clos = local_data.clos.get(&ot)?;
                let ab = clos.contains(&(a.clone(), b.clone()));
                let ba = clos.contains(&(b.clone(), a.clone()));
                if !ab || !ba {
                    return None;
                }
            }
        }
    }

    // Build undirected components using the loop-check predicate (symmetrized).
    let partition = connected_partitions(&local_data.alphabet, |i, j| {
        let ai = &local_data.alphabet[i];
        let aj = &local_data.alphabet[j];
        check_loop(local_data, global_data, ai, aj)
            || check_loop(local_data, global_data, aj, ai)
            || ai == aj
    });

    if partition.len() == 1 {
        return None;
    }

    // Identify body/redo per object type.
    for ot in &local_data.object_types {
        // Skip object types that are never related without being fully divergent.
        let participates = local_data.alphabet.iter().any(|act| {
            let rel = global_data
                .related
                .get(act)
                .map(|set| set.contains(ot))
                .unwrap_or(false);
            let div = global_data
                .divergence
                .get(act)
                .map(|set| set.contains(ot))
                .unwrap_or(false);
            rel && !div
        });
        if !participates {
            continue;
        }

        let Some((_, starts, ends)) = local_data.dfgs.get(ot) else {
            continue;
        };

        let mut body: Vec<String> = Vec::new();
        let mut body_idx: Option<usize> = None;
        for (idx, part) in partition.iter().enumerate() {
            let has_boundary = part.iter().any(|a| {
                starts.get(a).copied().unwrap_or(0) > 0 || ends.get(a).copied().unwrap_or(0) > 0
            });
            if has_boundary {
                body = part.clone();
                body_idx = Some(idx);
                break;
            }
        }

        let Some(i) = body_idx else {
            continue;
        };

        for j in 0..partition.len() {
            if i == j {
                continue;
            }

            let related_in_part = partition[j].iter().any(|a| {
                global_data
                    .related
                    .get(a)
                    .map(|set| set.contains(ot))
                    .unwrap_or(false)
            });

            if !related_in_part {
                continue;
            }

            let redo: Vec<String> = partition
                .iter()
                .enumerate()
                .filter(|(idx, _)| *idx != i)
                .flat_map(|(_, part)| part.clone())
                .collect();

            if is_loop_cut_valid(local_data, global_data, &[body.clone(), redo.clone()]) {

                println!(
                    "Loop cut found with body {:?} and redo {:?} for object type {}",
                    body,
                    redo,
                    ot
                );

                return Some((vec![body.clone(), redo], OCPTOperatorType::Loop(None)));
            } else {
                return None;
            }
        }
    }

    None
}
