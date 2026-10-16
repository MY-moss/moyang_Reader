use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Knowledge,
    Memory,
    Skill,
}
impl Kind {
    pub fn key(self) -> &'static str {
        match self {
            Self::Knowledge => "knowledge",
            Self::Memory => "memory",
            Self::Skill => "skill",
        }
    }
}
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum RecordState {
    #[default]
    Active,
    Archived,
}
impl RecordState {
    pub fn key(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Archived => "archived",
        }
    }
}
fn importance() -> u8 {
    3
}
fn yes() -> bool {
    true
}
fn page_size() -> usize {
    30
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Asset {
    /// Relative skill resource path, for example references/guide.md.
    pub path: String,
    /// utf8 or base64. Resource content is stored, never executed.
    pub encoding: String,
    pub content: String,
}
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Sharing {
    /// Existing records retain the original project + Agent boundary.
    #[default]
    Legacy,
    Global,
    Project,
}
impl Sharing {
    pub fn key(self) -> &'static str {
        match self {
            Self::Legacy => "legacy",
            Self::Global => "global",
            Self::Project => "project",
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct SourceLocation {
    pub uri: String,
    pub fingerprint: String,
    #[serde(default)]
    pub page: Option<usize>,
    #[serde(default)]
    pub paragraph: Option<usize>,
    #[serde(default)]
    pub quote: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct SourceSnapshot {
    pub uri: String,
    pub format: String,
    pub fingerprint: String,
    pub imported_at: i64,
    #[serde(default)]
    pub checked_at: Option<i64>,
    #[serde(default)]
    pub locations: Vec<SourceLocation>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct RecordFields {
    pub kind: Kind,
    /// For skills this must be the portable lowercase-hyphen skill name.
    pub title: String,
    #[serde(default)]
    pub summary: String,
    pub body: String,
    #[serde(default)]
    pub project: String,
    #[serde(default)]
    pub agent: String,
    #[serde(default)]
    pub sharing: Sharing,
    #[serde(default)]
    pub tags: Vec<String>,
    /// Source URL, filename, conversation or human attribution.
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub snapshot: Option<SourceSnapshot>,
    /// preference, fact, context, decision, lesson, or procedure.
    #[serde(default)]
    pub memory_type: String,
    #[serde(default = "importance")]
    pub importance: u8,
    #[serde(default)]
    pub pinned: bool,
    /// Unix milliseconds. Omit for permanent memory.
    #[serde(default)]
    pub expires_at: Option<i64>,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub assets: Vec<Asset>,
    /// Additional SKILL.md frontmatter, retained across import/export.
    #[serde(default)]
    pub skill_meta: std::collections::BTreeMap<String, serde_json::Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Record {
    pub id: String,
    pub revision: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub state: RecordState,
    #[serde(flatten)]
    pub fields: RecordFields,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct SaveRequest {
    #[serde(default)]
    pub id: Option<String>,
    /// Required for updates: use revision from get_record to avoid overwriting another writer.
    #[serde(default)]
    pub expected_revision: Option<i64>,
    #[serde(default)]
    pub reason: String,
    #[serde(flatten)]
    pub fields: RecordFields,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Revision {
    pub record: Record,
    pub reason: String,
    pub recorded_at: i64,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct HistoryRequest {
    pub id: String,
    /// Continue before this revision; omit for the newest page.
    #[serde(default)]
    pub before_revision: Option<i64>,
    /// Defaults to 20; maximum 50 revisions per page.
    #[serde(default)]
    pub limit: Option<usize>,
}
#[derive(Debug, Clone, Serialize)]
pub struct RevisionSummary {
    pub revision: i64,
    pub title: String,
    pub reason: String,
    pub recorded_at: i64,
    pub body_chars: usize,
    pub resource_count: usize,
}
#[derive(Debug, Clone, Serialize)]
pub struct HistoryPage {
    pub items: Vec<RevisionSummary>,
    pub next_before: Option<i64>,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct SearchQuery {
    #[serde(default)]
    pub request_id: Option<String>,
    #[serde(default)]
    pub query: String,
    #[serde(default)]
    pub kind: Option<Kind>,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default = "yes")]
    pub include_global: bool,
    #[serde(default)]
    pub state: RecordState,
    #[serde(default)]
    pub include_expired: bool,
    #[serde(default = "page_size")]
    pub limit: usize,
    #[serde(default)]
    pub offset: usize,
    #[serde(default)]
    pub semantic: bool,
}
impl Default for SearchQuery {
    fn default() -> Self {
        serde_json::from_str("{}").unwrap()
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hit {
    pub id: String,
    pub kind: Kind,
    pub title: String,
    pub summary: String,
    pub project: String,
    pub agent: String,
    pub sharing: Sharing,
    pub tags: Vec<String>,
    pub source: String,
    pub revision: i64,
    pub updated_at: i64,
    pub pinned: bool,
    pub state: RecordState,
    pub excerpt: String,
    pub score: f64,
    #[serde(default)]
    pub fragments: Vec<Fragment>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fragment {
    pub ordinal: usize,
    pub text: String,
    pub location: SourceLocation,
    pub score: f64,
}
impl Hit {
    pub(crate) fn from_record(r: &Record, excerpt: String, score: f64) -> Self {
        Self {
            id: r.id.clone(),
            kind: r.fields.kind,
            title: r.fields.title.clone(),
            summary: r.fields.summary.clone(),
            project: r.fields.project.clone(),
            agent: r.fields.agent.clone(),
            sharing: r.fields.sharing,
            tags: r.fields.tags.clone(),
            source: r.fields.source.clone(),
            revision: r.revision,
            updated_at: r.updated_at,
            pinned: r.fields.pinned,
            state: r.state,
            excerpt,
            score,
            fragments: vec![],
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub items: Vec<Hit>,
    pub total: usize,
    pub warning: Option<String>,
}
#[derive(Debug, Default, Clone, Serialize, Deserialize, JsonSchema)]
pub struct SemanticConfig {
    pub enabled: bool,
    pub endpoint: String,
    pub model: String,
    /// Empty/ollama preserves the original local protocol; openai uses a saved API service.
    #[serde(default)]
    pub protocol: String,
    #[serde(default)]
    pub provider: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stats {
    pub knowledge: usize,
    pub memory: usize,
    pub skill: usize,
    pub archived: usize,
    pub expired: usize,
    pub indexed_chunks: usize,
    pub embedded_chunks: usize,
    pub semantic_paused: bool,
    pub projects: Vec<String>,
    pub agents: Vec<String>,
    pub database_path: String,
    pub semantic: SemanticConfig,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct IdRequest {
    pub id: String,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct RevisionRequest {
    pub id: String,
    pub revision: i64,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct DeleteRequest {
    pub id: String,
    pub expected_revision: i64,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct StateRequest {
    pub id: String,
    pub expected_revision: i64,
    pub state: RecordState,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct RestoreRequest {
    pub id: String,
    pub expected_revision: i64,
    pub revision: i64,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct MergeRequest {
    /// IDs of two or more memories. Current revisions must match.
    pub ids: Vec<String>,
    pub revisions: Vec<i64>,
    pub title: String,
    pub body: String,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct FeedbackRequest {
    pub id: String,
    pub useful: bool,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct AssetRequest {
    pub id: String,
    pub path: String,
    /// Omit for the current resource, or supply a historical revision.
    #[serde(default)]
    pub revision: Option<i64>,
}
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct ContextRequest {
    pub query: String,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub agent: Option<String>,
    /// Maximum Unicode characters, 1000–30000; default 8000.
    #[serde(default)]
    pub max_chars: Option<usize>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupFeedback {
    pub id: String,
    pub score: i64,
    pub uses: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Backup {
    pub format: String,
    pub version: u32,
    pub exported_at: i64,
    pub records: Vec<Record>,
    pub history: Vec<Revision>,
    #[serde(default)]
    pub feedback: Vec<BackupFeedback>,
    #[serde(default)]
    pub settings: std::collections::BTreeMap<String, String>,
    #[serde(default)]
    pub checkpoints: Vec<serde_json::Value>,
    #[serde(default)]
    pub conflicts: Vec<serde_json::Value>,
    #[serde(default)]
    pub activities: Vec<serde_json::Value>,
    #[serde(default)]
    pub memory_merges: Vec<serde_json::Value>,
}
