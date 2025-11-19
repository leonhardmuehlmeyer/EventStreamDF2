use axum::extract::Path;
use axum::{response::IntoResponse, http::StatusCode};
use crate::models::ocel::OCEL;
use crate::traits::import_export::ImportableFromPath;
use crate::core::ocim::algorithm::ocim_init;
use crate::core::struct_converters::ocpt_frontend_backend::backend_to_frontend;



pub async fn apply_ocim(Path(file_id): Path<String>) -> Result<impl IntoResponse, (StatusCode, String)> {
    let ocel = OCEL::import_from_path(&file_id).await?;

    let ocpt = ocim_init(&ocel);
    let ocpt_frontend = backend_to_frontend(&ocpt); //needed to add this step since frontend has a different ocpt format, than we use in the backend

    Ok(axum::Json(ocpt_frontend))
}