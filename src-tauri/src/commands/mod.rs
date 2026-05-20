mod comparison;
mod connection;
mod git;
mod history;
mod saved_queries;
mod settings;

pub use comparison::{compare_schemas, generate_migration_sql};
pub use connection::{execute_query, get_database_schema, get_database_schemas, test_postgres_connection, get_enhanced_database_schema};
pub use git::{check_git_repo, get_git_diff, get_git_log, get_git_status, git_commit, git_init, git_pull, git_push};
pub use history::{clear_query_history, get_query_history, save_query_to_history};
pub use saved_queries::{
    create_collection, delete_saved_query, get_saved_queries, list_collections, save_query,
    toggle_pin_query,
};
pub use settings::{
    delete_connection_password, get_app_dir, get_auto_connect_enabled, get_connection_password,
    get_current_project_path, get_last_connection, load_connections, load_project_settings,
    save_connection_password, save_connections, set_auto_connect_enabled, set_last_connection,
    set_project_path, get_recent_projects, remove_recent_project, get_vim_mode_enabled,
    set_vim_mode_enabled, verify_project_access,
};
