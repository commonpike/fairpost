enum SourceStatus {
  UNKNOWN = "unknown",
  INCOMING = "incoming", // no posts
  PENDING = "pending", // all posts unscheduled
  CURRENT = "current", // mixed post statuses
  DONE = "done", // all posts published or canceled
  ARCHIVED = "archived",
}
export default SourceStatus;
