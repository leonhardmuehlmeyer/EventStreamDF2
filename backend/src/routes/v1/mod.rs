pub mod conformance;
pub mod event_object_frequencies;
pub mod objects;
pub mod upload;
use axum::Router;

pub fn router() -> Router {
    Router::new()
        .nest("/upload", upload::router())
        .nest("/objects", objects::router())
        .nest("/conformance", conformance::router())
        .nest(
            "/event_object_frequencies",
            event_object_frequencies::router(),
        )
}
