-- Senegram - statuts messages, presence, pins et reactions
-- A appliquer sur une base existante apres backend/database/schema.sql.

ALTER TABLE users
  ADD COLUMN is_online BOOLEAN NOT NULL DEFAULT FALSE AFTER status,
  ADD INDEX idx_users_online_last_seen (is_online, last_seen);

ALTER TABLE messages
  ADD COLUMN sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_at,
  ADD COLUMN delivered_at DATETIME DEFAULT NULL AFTER sent_at,
  ADD COLUMN read_at DATETIME DEFAULT NULL AFTER delivered_at,
  ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE AFTER read_at,
  ADD COLUMN pinned_by BIGINT UNSIGNED DEFAULT NULL AFTER is_pinned,
  ADD COLUMN pinned_at DATETIME DEFAULT NULL AFTER pinned_by,
  ADD INDEX idx_messages_status (conversation_id, sender_id, delivered_at, read_at),
  ADD INDEX idx_messages_pinned (conversation_id, is_pinned, pinned_at),
  ADD CONSTRAINT fk_messages_pinned_by FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE message_reactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  reaction VARCHAR(8) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_message_reaction_user (message_id, user_id),
  INDEX idx_reactions_message (message_id, reaction),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
