use axum::extract::Path;
use axum::{response::IntoResponse, http::StatusCode};
use crate::models::ocel::OCEL;
use crate::traits::import_export::ImportableFromPath;
use crate::core::ocim::algorithm::ocim_init;


pub async fn apply_ocim(Path(file_id): Path<String>) -> Result<impl IntoResponse, (StatusCode, String)> {
    let ocel = OCEL::import_from_path(&file_id).await?;

    let ocpt = ocim_init(&ocel);

    Ok(axum::Json(ocpt))
}