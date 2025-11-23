use std::collections::{HashMap, HashSet};

use petgraph::algo::toposort;
use petgraph::graph::DiGraph;
use petgraph::unionfind::UnionFind;
use rustc_hash::{FxHashMap, FxHashSet};
use crate::core::ocim::auxiliary_methods::{get_divergent_types, get_non_divergent_types};
use crate::core::ocim::common_data::{GlobalData, LocalData};
use crate::core::ocim::sequence_cut::is_sequence_cut_valid;

/// Check sequence condition 1:
/// for each non-divergent object type shared by (a,b), the closure must be
/// either bi-directional or absent in both directions.
fn check_sequence_1(
    local_data: &LocalData,
    global_data: &GlobalData,
    a: &String,
    b: &String,
) -> bool {
    for ot in get_non_divergent_types(a, b, &[a.clone(), b.clone()], global_data) {
        if let Some(clos) = local_data.clos.get(&ot) {
            let ab = clos.contains(&(a.clone(), b.clone()));
            let ba = clos.contains(&(b.clone(), a.clone()));
            // Follow the Python condition: group when both directions exist or both are absent.
            if (ab && ba) || (!ab && !ba) {
                return true;
            }
        }
    }
    false
}

/// Check sequence condition 2 on partition-level reachability.
/// Returns true if both directions are present or both absent between partitions i and j.
fn check_sequence_2(
    partition_closure: &HashSet<(usize, usize)>,
    i: usize,
    j: usize,
) -> bool {
    let ij = partition_closure.contains(&(i, j));
    let ji = partition_closure.contains(&(j, i));
    // Print in a stable sorted order of pairs for readability.
    let mut sorted: Vec<_> = partition_closure.iter().cloned().collect();
    sorted.sort();
    println!(
        "[trace] check_sequence_2: i={}, j={}, ij={}, ji={}, closure={:?}",
        i, j, ij, ji, sorted
    );
    (ij && ji) || (!ij && !ji)
}

/// Check sequence condition 3:
/// if any divergent object type in the combined segment lacks bi-directional DFG edges, return true.
fn check_sequence_3(
    local_data: &LocalData,
    global_data: &GlobalData,
    partition: &[Vec<String>],
    mut i: usize,
    mut j: usize,
) -> bool {
    if i > j {
        std::mem::swap(&mut i, &mut j);
    }

    let segment: Vec<String> = partition[i..=j]
        .iter()
        .flat_map(|p| p.iter().cloned())
        .collect();

    for a in &partition[i] {
        for b in &partition[j] {
            for ot in get_divergent_types(a, b, &segment, global_data) {
                if let Some((dfg, _, _)) = local_data.dfgs.get(&ot) {
                    let ab = dfg.contains_key(&(a.clone(), b.clone()));
                    let ba = dfg.contains_key(&(b.clone(), a.clone()));
                    if !ab || !ba {
                        return true;
                    }
                }
            }
        }
    }
    false
}

/// Compute immediate partition follows edges using per-otype activity closure.
/// For each object type, if there is a closure edge (a,b) and they belong to
/// different partitions, add (i,j).
fn partition_edges(local_data: &LocalData, partition: &[Vec<String>]) -> HashSet<(usize, usize)> {
    let mut all_edges = HashSet::new();
    for (ot, clos) in &local_data.clos {
        let mut ot_edges = Vec::new();
        for (a, b) in clos.iter() {
            if let (Some(i), Some(j)) = (partition_index(partition, a), partition_index(partition, b))
            {
                if i != j {
                    ot_edges.push((i, j));
                }
            }
        }

        // Compute transitive closure for this object type's partition graph
        let n = partition.len();
        let mut adj = vec![vec![false; n]; n];
        for (i, j) in ot_edges {
            adj[i][j] = true;
        }
        for i in 0..n {
            adj[i][i] = true; // for path extension
        }
        for k in 0..n {
            for i in 0..n {
                for j in 0..n {
                    if adj[i][k] && adj[k][j] {
                        adj[i][j] = true;
                    }
                }
            }
        }
        for i in 0..n {
            for j in 0..n {
                if i != j && adj[i][j] {
                    all_edges.insert((i, j));
                }
            }
        }
    }
    all_edges
}

/// Compute transitive closure of partition reachability.
fn partition_closure(local_data: &LocalData, partition: &[Vec<String>]) -> HashSet<(usize, usize)> {
    // The logic is now moved into partition_edges to operate per object type.
    partition_edges(local_data, partition)
}

/// Merge cyclic partitions (both directions reachable) into a single part.
fn remove_cycles(
    partition: Vec<Vec<String>>,
    local_data: &LocalData,
) -> (Vec<Vec<String>>, bool) {
    let closure = partition_closure(local_data, &partition);
    let mut result = Vec::new();
    let mut done = HashSet::new();
    let mut change = false;

    for i in 0..partition.len() {
        if done.contains(&i) {
            continue;
        }
        let mut merged = partition[i].clone();
        for j in (i + 1)..partition.len() {
            if done.contains(&j) {
                continue;
            }
            if closure.contains(&(i, j)) && closure.contains(&(j, i)) {
                merged.extend(partition[j].iter().cloned());
                done.insert(j);
                change = true;
            }
        }
        done.insert(i);
        merged.sort();
        merged.dedup();
        result.push(merged);
    }

    (result, change)
}

/// Build connected components from an undirected adjacency predicate.
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

/// Find the partition index that contains the activity.
fn partition_index(partition: &[Vec<String>], act: &str) -> Option<usize> {
    partition.iter().position(|p| p.iter().any(|x| x == act))
}

/// Build alphabet per object type from the local log list, mimicking the Python helper.
fn alphabet_by_ot_from_local(local_data: &LocalData) -> FxHashMap<String, Vec<String>> {
    let mut by_ot: FxHashMap<String, Vec<String>> = FxHashMap::default();
    for ot in &local_data.object_types {
        by_ot.entry(ot.clone()).or_default();
    }
    for log in &local_data.oc_log_list {
        for ot in &local_data.object_types {
            let mut acts: FxHashSet<String> = FxHashSet::default();
            for ev in &log.events {
                // collect related object types for this event
                let related_ots: FxHashSet<String> = ev
                    .relationships
                    .iter()
                    .filter_map(|rel| {
                        log.objects
                            .iter()
                            .find(|obj| obj.id == rel.object_id)
                            .map(|obj| obj.object_type.clone())
                    })
                    .collect();
                if related_ots.contains(ot) {
                    acts.insert(ev.event_type.clone());
                }
            }
            let entry = by_ot.entry(ot.clone()).or_default();
            entry.extend(acts.into_iter());
        }
    }
    for vals in by_ot.values_mut() {
        vals.sort();
        vals.dedup();
    }
    by_ot
}

/// Build a topological ordering of partitions using direct follows edges; if cyclic, keep original order.
fn topo_order_partitions(partition: &[Vec<String>], local_data: &LocalData) -> Vec<Vec<String>> {
    let edges = partition_edges(local_data, partition);
    let mut g: DiGraph<usize, ()> = DiGraph::new();
    let nodes: Vec<_> = (0..partition.len()).map(|i| g.add_node(i)).collect();
    for (i, j) in edges {
        g.add_edge(nodes[i], nodes[j], ());
    }
    match toposort(&g, None) {
        // order yields NodeIndex; use the stored weight (usize) to index the partition slice.
        Ok(order) => order
            .into_iter()
            .filter_map(|node| g.node_weight(node).copied())
            .map(|idx| partition[idx].clone())
            .collect(),
        Err(_) => partition.to_vec(),
    }
}

/// Rust port of the Python `find_cut_sequence` detection pipeline.
/// Returns Some(partitioning) if a valid sequence cut is found, otherwise None.
pub fn find_cut_sequence(
    local_data: &LocalData,
    global_data: &GlobalData,
) -> Option<Vec<Vec<String>>> {
    // Stage 1: components by check_sequence_1
    let partition = connected_partitions(&local_data.alphabet, |i, j| {
        check_sequence_1(
            local_data,
            global_data,
            &local_data.alphabet[i],
            &local_data.alphabet[j],
        )
    });
    println!("[trace] stage1 partitions: {:?}", partition);
    println!(
        "[trace] stage1 alphabets per ot: {:?}",
        alphabet_by_ot_from_local(local_data)
    );
    if partition.len() == 1 {
        return None;
    }
    ///////////////////////////////////////////////////////////////////////////////////////////// tested
    // Stage 2: include partition-level reachability condition
    let closure = partition_closure(local_data, &partition);
    let partition_stage1 = partition.clone();
    let partition = connected_partitions(&local_data.alphabet, |i, j| {
        check_sequence_1(
            local_data,
            global_data,
            &local_data.alphabet[i],
            &local_data.alphabet[j],
        ) || {
            let pi = partition_index(&partition_stage1, &local_data.alphabet[i]).unwrap();
            let pj = partition_index(&partition_stage1, &local_data.alphabet[j]).unwrap();
            check_sequence_2(&closure, pi, pj)
        }
    });
    if partition.len() == 1 {
        return None;
    }

    // Stage 3: order partitions topologically and re-cluster with sequence_3 condition
    let mut partition = topo_order_partitions(&partition, local_data);
    let closure = partition_closure(local_data, &partition);
    let partition = connected_partitions(&local_data.alphabet, |i, j| {
        let pi = partition_index(&partition, &local_data.alphabet[i]).unwrap();
        let pj = partition_index(&partition, &local_data.alphabet[j]).unwrap();
        check_sequence_1(
            local_data,
            global_data,
            &local_data.alphabet[i],
            &local_data.alphabet[j],
        ) || check_sequence_2(&closure, pi, pj)
            || check_sequence_3(local_data, global_data, &partition, pi, pj)
    });

    // Merge cycles until stable
    let mut partition = partition;
    loop {
        let (p, changed) = remove_cycles(partition, local_data);
        partition = p;
        if !changed {
            break;
        }
    }

    if partition.len() == 1 {
        return None;
    }

    // Final topological order and validation
    partition = topo_order_partitions(&partition, local_data);
    if partition.len() == 1 {
        return None;
    }

    if is_sequence_cut_valid(local_data, global_data, &partition) {
        return Some(partition);
    } else {
        return None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ocel::OCEL;
    use std::path::Path;
    use serde_json;

    fn empty_ocel() -> OCEL {
        OCEL {
            events: Vec::new(),
            objects: Vec::new(),
            event_types: Vec::new(),
            object_types: Vec::new(),
        }
    }

    fn set_of(items: &[&str]) -> FxHashSet<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    fn make_local_data(
        alphabet: &[&str],
        object_types: &[&str],
        dfgs: FxHashMap<
            String,
            (
                FxHashMap<(String, String), u32>,
                FxHashMap<String, u32>,
                FxHashMap<String, u32>,
            ),
        >,
        clos: FxHashMap<String, FxHashSet<(String, String)>>,
    ) -> LocalData {
        LocalData {
            oc_log_list: vec![empty_ocel()],
            alphabet: alphabet.iter().map(|s| s.to_string()).collect(),
            object_types: object_types.iter().map(|s| s.to_string()).collect(),
            object_set: FxHashSet::default(),
            expected_objects: FxHashSet::default(),
            dfgs,
            clos,
        }
    }

    fn make_global_data(
        divergence: FxHashMap<String, FxHashSet<String>>,
        related: FxHashMap<String, FxHashSet<String>>,
    ) -> GlobalData {
        GlobalData {
            oc_log_list: vec![empty_ocel()],
            divergence,
            convergence: FxHashMap::default(),
            related,
            deficiency: FxHashMap::default(),
        }
    }

    #[test]
    fn detects_simple_sequence_cut() {
        // A then B for non-divergent ot1 (closure only A->B).
        let mut clos = FxHashMap::default();
        clos.insert(
            "ot1".to_string(),
            [("A".to_string(), "B".to_string())].into_iter().collect(),
        );

        let local = make_local_data(&["A", "B"], &["ot1"], FxHashMap::default(), clos);

        let mut related = FxHashMap::default();
        related.insert("A".to_string(), set_of(&["ot1"]));
        related.insert("B".to_string(), set_of(&["ot1"]));
        let global = make_global_data(FxHashMap::default(), related);

        let cut = find_cut_sequence(&local, &global);
        assert!(cut.is_some(), "expected sequence cut");
        let parts = cut.unwrap();
        assert_eq!(parts.len(), 2);
        assert!(parts[0].contains(&"A".to_string()));
        assert!(parts[1].contains(&"B".to_string()));
    }

    #[test]
    fn no_cut_when_bidirectional() {
        // Both directions in closure -> sequence cut should collapse.
        let mut clos = FxHashMap::default();
        clos.insert(
            "ot1".to_string(),
            [
                ("A".to_string(), "B".to_string()),
                ("B".to_string(), "A".to_string()),
            ]
            .into_iter()
            .collect(),
        );

        let local = make_local_data(&["A", "B"], &["ot1"], FxHashMap::default(), clos);

        let mut related = FxHashMap::default();
        related.insert("A".to_string(), set_of(&["ot1"]));
        related.insert("B".to_string(), set_of(&["ot1"]));
        let global = make_global_data(FxHashMap::default(), related);

        let cut = find_cut_sequence(&local, &global);
        assert!(cut.is_none(), "no sequence cut expected when bidirectional");
    }

    #[test]
    fn detects_cut_and_keeps_cycle_grouped() {
        // A and B form a cycle; C only reachable from B. Expect partition [A,B], [C].
        let mut clos = FxHashMap::default();
        clos.insert(
            "ot1".to_string(),
            [
                ("A".to_string(), "B".to_string()),
                ("B".to_string(), "A".to_string()),
                ("B".to_string(), "C".to_string()),
            ]
            .into_iter()
            .collect(),
        );

        let local = make_local_data(&["A", "B", "C"], &["ot1"], FxHashMap::default(), clos);

        let mut related = FxHashMap::default();
        related.insert("A".to_string(), set_of(&["ot1"]));
        related.insert("B".to_string(), set_of(&["ot1"]));
        related.insert("C".to_string(), set_of(&["ot1"]));
        let global = make_global_data(FxHashMap::default(), related);

        let cut = find_cut_sequence(&local, &global).expect("expected a sequence cut");
        assert_eq!(cut.len(), 2);
        assert!(cut[0].contains(&"A".to_string()) && cut[0].contains(&"B".to_string()));
        assert!(cut[1].contains(&"C".to_string()));
    }

    #[test]
    fn no_cut_without_relations() {
        // No related types -> detection should yield None.
        let local = make_local_data(&["A", "B"], &["ot1"], FxHashMap::default(), FxHashMap::default());
        let global = make_global_data(FxHashMap::default(), FxHashMap::default());

        let cut = find_cut_sequence(&local, &global);
        assert!(cut.is_none(), "expected no sequence cut without relations");
    }

    #[test]
    fn example_log_detects_sequence_cut() {
        // Integration-style check against the provided example OCEL.
        let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
        let path = manifest
            .join("..")
            .join("example_data")
            .join("ocel")
            .join("example_log_ocim.json");

        let data = std::fs::read_to_string(&path).expect("read example OCEL file");
        let ocel: OCEL = serde_json::from_str(&data).expect("parse example OCEL");

        let local = LocalData::new(vec![ocel.clone()], None);
        let global = GlobalData::new(vec![ocel]);

        // Use a traced version to understand why detection might fail.
        let cut = trace_find_cut_sequence(&local, &global);
        match cut {
            Some(parts) => {
                println!("Sequence cut partitions: {:?}", parts);
                assert!(!parts.is_empty(), "partitions should not be empty");
            }
            None => panic!("expected sequence cut for example OCEL"),
        }
    }

    #[test]
    fn example_log_detects_sequence_cut_direct() {
        let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
        let path = manifest
            .join("..")
            .join("example_data")
            .join("ocel")
            .join("example_log_ocim.json");

        let data = std::fs::read_to_string(&path).expect("read example OCEL file");
        let ocel: OCEL = serde_json::from_str(&data).expect("parse example OCEL");

        let local = LocalData::new(vec![ocel.clone()], None);
        let global = GlobalData::new(vec![ocel]);

        let cut = find_cut_sequence(&local, &global);
        assert!(cut.is_some(), "expected sequence cut for example OCEL (direct call)");
    }

    /// Diagnostic helper to print intermediate partitions and return the final result.
    fn trace_find_cut_sequence(
        local_data: &LocalData,
        global_data: &GlobalData,
    ) -> Option<Vec<Vec<String>>> {
        // Stage 1: components by check_sequence_1
        let partition1 = connected_partitions(&local_data.alphabet, |i, j| {
            check_sequence_1(
                local_data,
                global_data,
                &local_data.alphabet[i],
                &local_data.alphabet[j],
            )
        });
        println!("[trace] stage1 partitions: {:?}", partition1);
        if partition1.len() == 1 {
            println!("[trace] stage1 collapsed to single partition");
            return None;
        }

        // Stage 2: include partition-level reachability condition
        let closure1 = partition_closure(local_data, &partition1);
        let partition2 = connected_partitions(&local_data.alphabet, |i, j| {
            check_sequence_1(
                local_data,
                global_data,
                &local_data.alphabet[i],
                &local_data.alphabet[j],
            ) || {
                let pi = partition_index(&partition1, &local_data.alphabet[i]).unwrap();
                let pj = partition_index(&partition1, &local_data.alphabet[j]).unwrap();
                check_sequence_2(&closure1, pi, pj)
            }
        });
        println!("[trace] stage2 partitions: {:?}", partition2);
        if partition2.len() == 1 {
            println!("[trace] stage2 collapsed to single partition");
            return None;
        }

        // Stage 3: order partitions topologically and re-cluster with sequence_3 condition
        let mut partition3 = topo_order_partitions(&partition2, local_data);
        let closure2 = partition_closure(local_data, &partition3);
        let partition3 = connected_partitions(&local_data.alphabet, |i, j| {
            let pi = partition_index(&partition3, &local_data.alphabet[i]).unwrap();
            let pj = partition_index(&partition3, &local_data.alphabet[j]).unwrap();
            check_sequence_1(
                local_data,
                global_data,
                &local_data.alphabet[i],
                &local_data.alphabet[j],
            ) || check_sequence_2(&closure2, pi, pj)
                || check_sequence_3(local_data, global_data, &partition3, pi, pj)
        });
        println!("[trace] stage3 partitions: {:?}", partition3);

        // Merge cycles until stable
        let mut partition = partition3;
        loop {
            let (p, changed) = remove_cycles(partition, local_data);
            println!("[trace] cycle-merge step: {:?}, changed={}", p, changed);
            partition = p;
            if !changed {
                break;
            }
        }
        if partition.len() == 1 {
            println!("[trace] collapsed to single partition after cycle merge");
            return None;
        }

        // Final topological order and validation
        partition = topo_order_partitions(&partition, local_data);
        println!("[trace] final topo order: {:?}", partition);
        if partition.len() == 1 {
            println!("[trace] collapsed to single partition after topo order");
            return None;
        }

        if is_sequence_cut_valid(local_data, global_data, &partition) {
            println!("[trace] sequence cut validated");
            Some(partition)
        } else {
            println!("[trace] sequence cut invalidated by validator");
            None
        }
    }
}
