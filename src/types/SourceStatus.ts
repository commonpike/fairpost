enum SourceStatus {
  PENDING = "pending", // all posts unscheduled
  ACTIVE = "active", // mixed post statuses
  DONE = "done", // all posts published or canceled
  INCOMING = "incoming", // no posts
  ARCHIVED = "archived",
  UNKNOWN = "unknown",
}
export default SourceStatus;
