use crate::models::ocel_collection::OCELCollection;
use crate::traits::import_export::ImportableFromPath;
use axum::{Json, extract::Path, http::StatusCode, response::IntoResponse};
use serde_json::Value;

pub async fn get_collection_ocels(Path(file_id): Path<String>) -> impl IntoResponse {
    match OCELCollection::import_from_path(&file_id).await {
        Ok(collection) => {
            let mut payload_map: serde_json::Map<String, Value> =
                collection.attributes.into_iter().collect();
            let case_ocels_value = match serde_json::to_value(collection.ocels) {
                Ok(value) => value,
                Err(err) => {
                    eprintln!("Failed to serialize stored case OCEL collection: {}", err);
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "Failed to serialize stored case OCEL collection".to_string(),
                    )
                        .into_response();
                }
            };
            payload_map.insert("case_ocels".to_string(), case_ocels_value);
            (StatusCode::OK, Json(Value::Object(payload_map))).into_response()
        }
        Err((status, message)) => (status, message).into_response(),
    }
}
