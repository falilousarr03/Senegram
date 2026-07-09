-- =====================================================
--  SENEGRAM - Schéma MySQL
--  Base pour une messagerie temps-réel (chat, groupes,
--  fichiers, appels audio / vidéo WebRTC).
-- =====================================================

DROP DATABASE IF EXISTS senegram;
CREATE DATABASE senegram CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE senegram;

-- -----------------------------------------------------
-- Utilisateurs
-- -----------------------------------------------------
CREATE TABLE users (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username         VARCHAR(50)  NOT NULL UNIQUE,
  email            VARCHAR(150) NOT NULL UNIQUE,
  phone            VARCHAR(30)  DEFAULT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  display_name     VARCHAR(100) NOT NULL,
  bio              VARCHAR(255) DEFAULT NULL,
  avatar_url       VARCHAR(500) DEFAULT NULL,
  status           ENUM('online','offline','away','busy') DEFAULT 'offline',
  is_online        BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen        DATETIME DEFAULT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_username (username),
  INDEX idx_users_email    (email),
  INDEX idx_users_online_last_seen (is_online, last_seen)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Contacts (carnet d'adresses)
-- -----------------------------------------------------
CREATE TABLE contacts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  contact_user_id BIGINT UNSIGNED NOT NULL,
  alias           VARCHAR(100) DEFAULT NULL,
  is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_contact (user_id, contact_user_id),
  FOREIGN KEY (user_id)         REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Conversations (private = 1-1, group = groupe)
-- -----------------------------------------------------
CREATE TABLE conversations (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type        ENUM('private','group') NOT NULL,
  name        VARCHAR(150) DEFAULT NULL,     -- utilisé pour les groupes
  description VARCHAR(500) DEFAULT NULL,
  avatar_url  VARCHAR(500) DEFAULT NULL,
  created_by  BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Membres d'une conversation (+ rôle pour les groupes)
-- -----------------------------------------------------
CREATE TABLE conversation_members (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id       BIGINT UNSIGNED NOT NULL,
  user_id               BIGINT UNSIGNED NOT NULL,
  role                  ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
  joined_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_read_message_id  BIGINT UNSIGNED DEFAULT NULL,
  is_muted              BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uniq_member (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Messages
-- -----------------------------------------------------
CREATE TABLE messages (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id       BIGINT UNSIGNED NOT NULL,
  content         TEXT,
  type            ENUM('text','image','video','audio','file','system','call') NOT NULL DEFAULT 'text',
  reply_to_id     BIGINT UNSIGNED DEFAULT NULL,
  is_edited       BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at    DATETIME DEFAULT NULL,
  read_at         DATETIME DEFAULT NULL,
  is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_by       BIGINT UNSIGNED DEFAULT NULL,
  pinned_at       DATETIME DEFAULT NULL,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_messages_conv (conversation_id, created_at),
  INDEX idx_messages_status (conversation_id, sender_id, delivered_at, read_at),
  INDEX idx_messages_pinned (conversation_id, is_pinned, pinned_at),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)       REFERENCES users(id)         ON DELETE CASCADE,
  FOREIGN KEY (reply_to_id)     REFERENCES messages(id)      ON DELETE SET NULL,
  FOREIGN KEY (pinned_by)       REFERENCES users(id)         ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Pièces-jointes liées à un message
-- -----------------------------------------------------
CREATE TABLE attachments (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id  BIGINT UNSIGNED NOT NULL,
  url         VARCHAR(500) NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_size   BIGINT UNSIGNED DEFAULT 0,
  mime_type   VARCHAR(120) NOT NULL,
  duration    INT DEFAULT NULL,   -- en ms pour audio/video
  width       INT DEFAULT NULL,
  height      INT DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attachments_message (message_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Lectures (read-receipts) par message / par utilisateur
-- -----------------------------------------------------
CREATE TABLE message_reads (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id  BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  read_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_read (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Reactions aux messages
-- -----------------------------------------------------
CREATE TABLE message_reactions (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id  BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  reaction    VARCHAR(8) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_message_reaction_user (message_id, user_id),
  INDEX idx_reactions_message (message_id, reaction),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Appels (audio / vidéo)
-- -----------------------------------------------------
CREATE TABLE calls (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id  BIGINT UNSIGNED NOT NULL,
  caller_id        BIGINT UNSIGNED NOT NULL,
  type             ENUM('audio','video') NOT NULL,
  status           ENUM('ringing','ongoing','ended','missed','rejected') NOT NULL DEFAULT 'ringing',
  started_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at         DATETIME DEFAULT NULL,
  duration         INT UNSIGNED DEFAULT 0,    -- secondes
  INDEX idx_calls_conv (conversation_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (caller_id)       REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Participants d'un appel (surtout pour les groupes)
-- -----------------------------------------------------
CREATE TABLE call_participants (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  call_id   BIGINT UNSIGNED NOT NULL,
  user_id   BIGINT UNSIGNED NOT NULL,
  joined_at DATETIME DEFAULT NULL,
  left_at   DATETIME DEFAULT NULL,
  UNIQUE KEY uniq_participant (call_id, user_id),
  FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- Jeu de données de démo (optionnel) - mots de passe à 'password'
--   (hash bcrypt généré avec saltRounds=10)
-- =====================================================
-- Les mots de passe correspondent à "password"
INSERT INTO users (username,email,password_hash,display_name,bio,avatar_url)
VALUES
('aminata','aminata@senegram.sn','$2a$10$A/hIkQE7Fg/u3kDltg8YfOSLX0dr9JGqncdOsNuYoiIqtwvwhLO52','Aminata Diop','Teranga Dakar','https://i.pravatar.cc/150?img=47'),
('moussa','moussa@senegram.sn','$2a$10$A/hIkQE7Fg/u3kDltg8YfOSLX0dr9JGqncdOsNuYoiIqtwvwhLO52','Moussa Sarr','Thiès',            'https://i.pravatar.cc/150?img=12'),
('fatou','fatou@senegram.sn','$2a$10$A/hIkQE7Fg/u3kDltg8YfOSLX0dr9JGqncdOsNuYoiIqtwvwhLO52','Fatou Ndiaye','Saint-Louis',       'https://i.pravatar.cc/150?img=32');
