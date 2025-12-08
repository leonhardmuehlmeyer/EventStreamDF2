pub mod case_notion;
pub mod conformance;
pub mod df2;
pub mod event_object_frequencies;
pub mod log_graphs;
pub mod objects;
pub mod upload;
pub mod ocim;
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
        .nest("/case_notion", case_notion::router())
        .nest("/log_graphs", log_graphs::router())
        .nest("/ocpt", df2::router())
        .nest("/ocpt", ocim::router())
}
