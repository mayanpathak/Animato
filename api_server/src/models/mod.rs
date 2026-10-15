// pub mod models;

// pub use models::User;




// pub use user::User;
// pub use job::{JobStatus, RenderJob, RenderResult};

// pub mod models;
// pub mod jobmodel;

// pub use models::User;
// pub use jobmodel::{JobStatus, RenderJob, RenderResult};


pub mod user;       // user.rs
pub mod jobmodel;   // jobmodel.rs

pub use user::User;
pub use jobmodel::{JobStatus, Library, RenderJob, RenderResult};