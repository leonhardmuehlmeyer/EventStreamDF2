use process_mining::OCEL;
use crate::models::ocpt::{OCPTNode, OCPT, OCPTOperatorType};
use crate::core::ocim::{
    common_data::{LocalData, GlobalData},
    basecase::basecase,
    sequence_cut_detection::find_cut_sequence,
    log_splitting::split_log,
    exclusive_cut_detection::find_cut_exclusive,
    concurrent_cut_detection::find_cut_concurrent,
    // loop_cut_detection::find_cut_loop,
};

pub fn ocim_init(log: &OCEL) -> OCPT {
    let local_data = LocalData::new(vec![log.clone()], None);
    let global_data = GlobalData::new(vec![log.clone()]);
    
    let root_node: OCPTNode = ocim_recursive(local_data, &global_data);
    OCPT::new(root_node)
}

fn ocim_recursive(local_data: LocalData, global_data: &GlobalData) -> OCPTNode {
    // --- Helper stubs you will replace with real implementations ---
    //
    // These are intentionally simple placeholders so this function compiles
    // and expresses the OCIM structure. Replace each `*_stub` with the
    // real helper when you implement them.
    //
    // Example replacements:
    // - let (tau_found, tau_objects) = taucase(&local_data, &global_data);
    // - let (split_logs, object_info) = splitlog_taucase(...);
    // - let base = basecase(&local_data);
    // - let (found_cut, parts) = findcut(&local_data);
    // - let (found_fallthrough, parts) = fallthrough(&local_data);

    // Stub: does TAU case apply to this local_data?
    let tau_case_found: bool = false;
    // If TAU case needs to return additional data (e.g., O'), return it here.
    // let tau_case_data = None;

    if tau_case_found {
        // TODO: Replace with real SPLITLOG(TAUCASE) and recursive call.
        // Example:
        // let (l_prime, _) = splitlog_taucase(local_data, tau_case_data, ...);
        // return ocim_recursive(l_prime, global_data_for_taucase);
        //
        // For now we return a small marker leaf that indicates TAU branch.
        return OCPTNode::new_leaf(Some("TAU_CASE_PLACEHOLDER".to_string()));
    }

    if local_data.alphabet.len() == 1 {
        return basecase(local_data, global_data);
    }

    // Try to find a strict cut
    if let Some((partition, operator)) = find_strict_cut(&local_data, global_data) {
        // A cut was found, now split the log and recurse.

        let sublogs = split_log(&local_data, partition, &operator, global_data);

        let subtrees: Vec<OCPTNode> = sublogs
            .into_iter()
            .map(|sublog| ocim_recursive(sublog, global_data))
            .collect();

        let mut operator_node = OCPTNode::new_operator(operator);
        for subtree in subtrees {
            operator_node.add_child(subtree);
        }
        return operator_node;

    } else {
        // If no cut found: try fallthrough (another strategy)
        let fallthrough_found: bool = false;
        let _fallthrough_partitions: Vec<Vec<String>> = Vec::new();

        if fallthrough_found {
            // Replace with real SPLITLOG on fallthrough partitions and recursion
            // For now return a placeholder leaf indicating fallthrough branch
            return OCPTNode::new_leaf(Some("FALLTHROUGH_PLACEHOLDER".to_string()));
        } else {
            // No cut and no fallthrough => algorithm would usually abort or return a leaf
            // Return a leaf indicating that no further decomposition was possible.
            return OCPTNode::new_leaf(Some("NO_CUT_FOUND".to_string()));
        }
    }
}

pub fn find_strict_cut(local_data: &LocalData, global_data: &GlobalData) -> Option<(Vec<Vec<String>>, OCPTOperatorType)> {
    for check in [find_cut_sequence,
        // find_cut_exclusive, 
        find_cut_concurrent, 
        // find_cut_loop,
        ] 
    {
        if let Some((partition, operator)) = check(local_data, global_data) {
            // global_data.quality_info["cuts"].append((partition, operator))
            return Some((partition, operator));
        }
    }
    None
}
