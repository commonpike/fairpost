enum SourceStatus {
  UNKNOWN = "unknown",
  INCOMING = "incoming", // no posts
  PREPARED = "prepared", // all posts unscheduled
  PROCESSING = "processing", // mixed post statuses
  PROCESSED = "processed", // all posts published, canceled or failed
  ARCHIVED = "archived",
}
export default SourceStatus;
