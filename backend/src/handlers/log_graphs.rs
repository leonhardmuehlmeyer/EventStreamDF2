use crate::core::case_notion::log_graphs::build_log_graph_type_level;
use crate::models::ocel::OCEL;
use crate::traits::import_export::ImportableFromPath;
use axum::{Json as AxumJson, extract::Path as AxumPath, http::StatusCode, response::IntoResponse};

/// GET /v1/log_graph/:file_id
/// -> loads ./temp/ocel_v2_{file_id}.json and returns the type-level log graph
pub async fn get_log_graph_type_level(
    AxumPath(ocel_file_id): AxumPath<String>,
) -> impl IntoResponse {
    let ocel: OCEL = match OCEL::import_from_path(&ocel_file_id).await {
        Ok(o) => o,
        Err((status, message)) => return (status, message).into_response(),
    };

    let graph = build_log_graph_type_level(&ocel);

    (StatusCode::OK, AxumJson(graph)).into_response()
}
