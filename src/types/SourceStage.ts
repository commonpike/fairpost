enum SourceStage {
  PENDING = "pending", // all posts unscheduled
  ACTIVE = "active", // mixed post statuses
  FINISHED = "finished", // all posts published or canceled
  INCOMING = "incoming", // no posts yet
  ARCHIVED = "archived",
  UNKNOWN = "unknown",
}
export default SourceStage;
