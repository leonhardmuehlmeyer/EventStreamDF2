use crate::handlers::conformance::{
    get_conformance_extended_ocpt_extended_ocpt, get_conformance_extended_ocpt_ocel,
    get_conformance_ocpt_ocel, get_conformance_ocpt_ocpt,
};
use axum::{Router, routing::get};

pub fn router() -> Router {
    Router::new()
        .route(
            "/ocpt/{ocpt_id}/ocel/{ocel_id}",
            get(get_conformance_ocpt_ocel),
        )
        .route(
            "/ocpt_1/{ocpt_id_1}/ocpt_2/{ocpt_id_2}",
            get(get_conformance_ocpt_ocpt),
        )
        .route(
            "/extended_ocpt/{extended_ocpt_id}/ocel/{ocel_id}",
            get(get_conformance_extended_ocpt_ocel),
        )
        .route(
            "/extended_ocpt_1/{extended_ocpt_id_1}/extended_ocpt_2/{extended_ocpt_id_2}",
            get(get_conformance_extended_ocpt_extended_ocpt),
        )
}
