use axum::{Json, extract::Path as AxumPath, response::IntoResponse};
use serde_json::json;

use crate::models::ocel::{IndexLinkedOCEL, OCEL};
use crate::models::ocpt::OCPT as BackendOCPT;
use crate::traits::import_export::ImportableFromPath;
use process_mining::conformance::object_centric::footprint_based_ocpt::{
    FootprintConformance, compute_footprint_conformance, compute_footprint_conformance_ocpt_vs_ocpt,
};
use process_mining::conformance::object_centric::object_centric_language_abstraction::{
    OCLanguageAbstraction, compute_fitness_precision,
};

fn conformance_payload(
    fitness: f64,
    precision: f64,
    footprint: &FootprintConformance,
) -> serde_json::Value {
    json!({
        "fitness": fitness,
        "precision": precision,
        "footprint": {
            "control_fitness": footprint.control_fitness,
            "control_precision": footprint.control_precision,
            "multiplicity_fitness": footprint.multiplicity_fitness,
            "multiplicity_precision": footprint.multiplicity_precision,
            "identity_fitness": footprint.identity_fitness,
            "identity_precision": footprint.identity_precision,
            "overall_fitness": footprint.overall_fitness,
            "overall_precision": footprint.overall_precision
        }
    })
}

/// GET /v1/conformance/ocpt/{ocpt_id}/ocel/{ocel_id}"
/// -> loads ./temp/ocpt_{ocpt_id}.json and ./temp/ocel_v2_{ocel_id}.json
pub async fn get_conformance_ocpt_ocel(
    AxumPath((ocpt_id, ocel_id)): AxumPath<(String, String)>,
) -> impl IntoResponse {
    // --- Load OCPT ---
    let ocpt_backend = match BackendOCPT::import_from_path(&ocpt_id).await {
        Ok(ocpt) => ocpt,
        Err((status, message)) => return (status, message).into_response(),
    };

    // --- Load OCEL ---
    let ocel_struct = match OCEL::import_from_path(&ocel_id).await {
        Ok(o) => o,
        Err((status, message)) => return (status, message).into_response(),
    };

    // --- Conformance ---
    let locel: IndexLinkedOCEL = IndexLinkedOCEL::from_ocel(ocel_struct);
    let model_abs = OCLanguageAbstraction::create_from_oc_process_tree(&ocpt_backend);
    let log_abs = OCLanguageAbstraction::create_from_ocel(&locel);
    let (fitness, precision) = compute_fitness_precision(&log_abs, &model_abs);
    let footprint = compute_footprint_conformance(&locel, &ocpt_backend);

    println!(
        "[conformance ocpt_ocel] ocpt_id={} ocel_id={} fitness={} precision={} footprint={{control_fitness={} control_precision={} multiplicity_fitness={} multiplicity_precision={} identity_fitness={} identity_precision={} overall_fitness={} overall_precision={}}}",
        ocpt_id,
        ocel_id,
        fitness,
        precision,
        footprint.control_fitness,
        footprint.control_precision,
        footprint.multiplicity_fitness,
        footprint.multiplicity_precision,
        footprint.identity_fitness,
        footprint.identity_precision,
        footprint.overall_fitness,
        footprint.overall_precision
    );

    Json(conformance_payload(fitness, precision, &footprint)).into_response()
}

/// GET /v1/conformance/ocpt_1/{ocpt_id_1}/ocpt_2/{ocpt_id_2}
/// -> loads ./temp/ocpt_{ocpt_id_1}.json and ./temp/ocpt_{ocpt_id_2}.json
pub async fn get_conformance_ocpt_ocpt(
    AxumPath((ocpt_id_1, ocpt_id_2)): AxumPath<(String, String)>,
) -> impl IntoResponse {
    let ocpt_1 = match BackendOCPT::import_from_path(&ocpt_id_1).await {
        Ok(ocpt) => ocpt,
        Err((status, message)) => return (status, message).into_response(),
    };
    let ocpt_2 = match BackendOCPT::import_from_path(&ocpt_id_2).await {
        Ok(ocpt) => ocpt,
        Err((status, message)) => return (status, message).into_response(),
    };

    let a_abs = OCLanguageAbstraction::create_from_oc_process_tree(&ocpt_1);
    let b_abs = OCLanguageAbstraction::create_from_oc_process_tree(&ocpt_2);
    let (fitness, precision) = compute_fitness_precision(&a_abs, &b_abs);
    let footprint = compute_footprint_conformance_ocpt_vs_ocpt(&ocpt_1, &ocpt_2);

    println!(
        "[conformance ocpt_ocpt] ocpt_id_1={} ocpt_id_2={} fitness={} precision={} footprint={{control_fitness={} control_precision={} multiplicity_fitness={} multiplicity_precision={} identity_fitness={} identity_precision={} overall_fitness={} overall_precision={}}}",
        ocpt_id_1,
        ocpt_id_2,
        fitness,
        precision,
        footprint.control_fitness,
        footprint.control_precision,
        footprint.multiplicity_fitness,
        footprint.multiplicity_precision,
        footprint.identity_fitness,
        footprint.identity_precision,
        footprint.overall_fitness,
        footprint.overall_precision
    );

    Json(conformance_payload(fitness, precision, &footprint)).into_response()
}

/// GET /v1/conformance/extended_ocpt/{extended_ocpt_id}/ocel/{ocel_id}
/// -> loads ./temp/extended_ocpt_{extended_ocpt_id}.json and ./temp/ocel_v2_{ocel_id}.json
pub async fn get_conformance_extended_ocpt_ocel(
    AxumPath((extended_ocpt_id, ocel_id)): AxumPath<(String, String)>,
) -> impl IntoResponse {
    let extended_ocpt_path = format!("./temp/extended_ocpt_{}.json", extended_ocpt_id);

    let extended_ocpt = match BackendOCPT::from_json_file(&extended_ocpt_path).await {
        Ok(ocpt) => ocpt,
        Err((status, message)) => return (status, message).into_response(),
    };

    let ocel_struct = match OCEL::import_from_path(&ocel_id).await {
        Ok(o) => o,
        Err((status, message)) => return (status, message).into_response(),
    };

    let locel: IndexLinkedOCEL = IndexLinkedOCEL::from_ocel(ocel_struct);
    let model_abs = OCLanguageAbstraction::create_from_oc_process_tree(&extended_ocpt);
    let log_abs = OCLanguageAbstraction::create_from_ocel(&locel);
    let (fitness, precision) = compute_fitness_precision(&log_abs, &model_abs);
    let footprint = compute_footprint_conformance(&locel, &extended_ocpt);

    println!(
        "[conformance extended_ocpt_ocel] extended_ocpt_id={} ocel_id={} fitness={} precision={} footprint={{control_fitness={} control_precision={} multiplicity_fitness={} multiplicity_precision={} identity_fitness={} identity_precision={} overall_fitness={} overall_precision={}}}",
        extended_ocpt_id,
        ocel_id,
        fitness,
        precision,
        footprint.control_fitness,
        footprint.control_precision,
        footprint.multiplicity_fitness,
        footprint.multiplicity_precision,
        footprint.identity_fitness,
        footprint.identity_precision,
        footprint.overall_fitness,
        footprint.overall_precision
    );

    Json(conformance_payload(fitness, precision, &footprint)).into_response()
}

/// GET /v1/conformance/extended_ocpt_1/{extended_ocpt_id_1}/extended_ocpt_2/{extended_ocpt_id_2}
/// -> loads ./temp/extended_ocpt_{extended_ocpt_id_1}.json and ./temp/extended_ocpt_{extended_ocpt_id_2}.json
pub async fn get_conformance_extended_ocpt_extended_ocpt(
    AxumPath((extended_ocpt_id_1, extended_ocpt_id_2)): AxumPath<(String, String)>,
) -> impl IntoResponse {
    let extended_ocpt_1_path = format!("./temp/extended_ocpt_{}.json", extended_ocpt_id_1);
    let extended_ocpt_2_path = format!("./temp/extended_ocpt_{}.json", extended_ocpt_id_2);

    let extended_ocpt_1 = match BackendOCPT::from_json_file(&extended_ocpt_1_path).await {
        Ok(ocpt) => ocpt,
        Err((status, message)) => return (status, message).into_response(),
    };
    let extended_ocpt_2 = match BackendOCPT::from_json_file(&extended_ocpt_2_path).await {
        Ok(ocpt) => ocpt,
        Err((status, message)) => return (status, message).into_response(),
    };

    let a_abs = OCLanguageAbstraction::create_from_oc_process_tree(&extended_ocpt_1);
    let b_abs = OCLanguageAbstraction::create_from_oc_process_tree(&extended_ocpt_2);
    let (fitness, precision) = compute_fitness_precision(&a_abs, &b_abs);
    let footprint = compute_footprint_conformance_ocpt_vs_ocpt(&extended_ocpt_1, &extended_ocpt_2);

    println!(
        "[conformance extended_ocpt_extended_ocpt] extended_ocpt_id_1={} extended_ocpt_id_2={} fitness={} precision={} footprint={{control_fitness={} control_precision={} multiplicity_fitness={} multiplicity_precision={} identity_fitness={} identity_precision={} overall_fitness={} overall_precision={}}}",
        extended_ocpt_id_1,
        extended_ocpt_id_2,
        fitness,
        precision,
        footprint.control_fitness,
        footprint.control_precision,
        footprint.multiplicity_fitness,
        footprint.multiplicity_precision,
        footprint.identity_fitness,
        footprint.identity_precision,
        footprint.overall_fitness,
        footprint.overall_precision
    );

    Json(conformance_payload(fitness, precision, &footprint)).into_response()
}
