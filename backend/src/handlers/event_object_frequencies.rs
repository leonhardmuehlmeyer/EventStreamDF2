use crate::core::event_object_frequencies::{
    histogram_builder::build_event_object_histograms, histogram_filtering::filter_ocel_histograms,
};

use crate::models::ocel::OCEL;
use crate::traits::import_export::ImportableFromPath;
use axum::{
    extract::Json as AxumJson, extract::Path as AxumPath, http::StatusCode, response::IntoResponse,
};

/// GET /v1/event_object_frequencies/:file_id
/// -> loads ./temp/ocpt_{file_id}.json and ./temp/ocel_{file_id}.json
pub async fn get_event_object_frequencies(
    AxumPath(file_id): AxumPath<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let ocel = OCEL::import_from_path(&file_id).await?;

    let histogram = build_event_object_histograms(&ocel);

    Ok(axum::Json(histogram))
}

/// POST /v1/ocel_filter/:file_id
/// Body: JSON following the `SelectionPayload` scheme
/// Returns: array of filtered OCELs
pub async fn post_ocel_filter(
    AxumPath(ocel_file_id): AxumPath<String>,
    AxumJson(selection_json): AxumJson<serde_json::Value>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let ocel = OCEL::import_from_path(&ocel_file_id).await?;

    // 2. Call filtering function
    let filtered_ocels = match serde_json::to_string(&selection_json) {
        Ok(json_str) => filter_ocel_histograms(&ocel, &json_str),
        Err(e) => {
            return Err((
                StatusCode::BAD_REQUEST,
                format!("Failed to serialize selection JSON: {}", e),
            ));
        }
    };

    // 3. Return JSON array of filtered OCELs
    Ok(axum::Json(filtered_ocels))
}
