use crate::core::ocim::common_data::{GlobalData, LocalData};
use crate::models::ocel::OCEL;
use crate::models::ocpt::OCPTOperatorType;
use rustc_hash::FxHashSet;

pub fn split_log(
    local_data: &LocalData,
    partition: Vec<Vec<String>>,
    operator: &OCPTOperatorType,
    _global_data: &GlobalData,
) -> Vec<LocalData> {
    match operator {
        OCPTOperatorType::Sequence | OCPTOperatorType::Concurrency => {
            let result: Vec<LocalData> = partition
                .into_iter()
                .filter(|part| !part.is_empty())
                .map(|part| {
                    let part_activities: FxHashSet<String> = part.iter().cloned().collect();

                    let new_oc_log_list: Vec<OCEL> = local_data
                        .oc_log_list
                        .iter()
                        .map(|log| {
                            let mut new_log = log.clone();

                            // Filter events based on the partition
                            new_log
                                .events
                                .retain(|event| part_activities.contains(&event.event_type));

                            // --- OCEL Consistency Cleanup ---
                            // 1. Update event types
                            let used_event_types: FxHashSet<String> = new_log
                                .events
                                .iter()
                                .map(|e| e.event_type.clone())
                                .collect();
                            new_log
                                .event_types
                                .retain(|et| used_event_types.contains(&et.name));

                            // 2. Update objects
                            let used_object_ids: FxHashSet<String> = new_log
                                .events
                                .iter()
                                .flat_map(|event| &event.relationships)
                                .map(|rel| rel.object_id.clone())
                                .collect();
                            new_log
                                .objects
                                .retain(|obj| used_object_ids.contains(&obj.id));

                            // 3. Update object types
                            let used_object_types: FxHashSet<String> = new_log
                                .objects
                                .iter()
                                .map(|o| o.object_type.clone())
                                .collect();
                            new_log
                                .object_types
                                .retain(|ot| used_object_types.contains(&ot.name));

                            new_log
                        })
                        .collect();

                    LocalData::new(new_oc_log_list, Some(local_data.expected_objects.clone()))
                })
                .collect();
            return result;
        }
        OCPTOperatorType::ExclusiveChoice => {
            vec![] // Placeholder
        }
        OCPTOperatorType::Loop(_repetitions) => {
            vec![] // Placeholder
        }
    }
}