use crate::traits::import_export::ImportableFromPath;
use async_trait::async_trait;
use axum::http::StatusCode;
#[allow(unused_imports)] // probably used in the future
pub use process_mining::ocel::linked_ocel;
pub use process_mining::ocel::linked_ocel::index_linked_ocel::{EventIndex, ObjectIndex};
pub use process_mining::ocel::linked_ocel::{IndexLinkedOCEL, LinkedOCELAccess};
#[allow(unused_imports)] // probably used in the future
pub use process_mining::ocel::ocel_struct::{
    OCEL, OCELAttributeType, OCELAttributeValue, OCELEvent, OCELEventAttribute, OCELObject,
    OCELObjectAttribute, OCELRelationship, OCELType, OCELTypeAttribute,
};

/// Implementation of [`ImportableFromPath`] for [`OCEL`].
///
/// This implementation constructs the file path using a standard naming pattern:
/// `./temp/ocel_v2_<file_id>.json`, then imports and deserializes the file using
/// [`ImportableFromPath::from_json_file`].
///
/// # Example
///
/// ```rust,ignore
/// let ocel = OCEL::import_from_path("18d356df-2be1-4af9-8618-debe98a0575b").await?;
/// ```
#[async_trait]
impl ImportableFromPath for OCEL {
    async fn import_from_path(file_id: &str) -> Result<Self, (StatusCode, String)> {
        let path = format!("./temp/ocel_v2_{}.json", file_id);
        Self::from_json_file(&path).await
    }
}
