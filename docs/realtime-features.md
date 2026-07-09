# Fonctionnalités temps réel Senegram

## Migration SQL

Pour une base existante, appliquer :

```bash
mysql -u root -p senegram < backend/database/migrations/20260709_message_status_presence_reactions.sql
```

Pour une nouvelle installation, `backend/database/schema.sql` contient déjà les colonnes et tables nécessaires.

La migration ajoute :

- `users.is_online`
- `messages.sent_at`, `messages.delivered_at`, `messages.read_at`
- `messages.is_pinned`, `messages.pinned_by`, `messages.pinned_at`
- `message_reactions`
- index de présence, statuts, messages épinglés et réactions

## Événements Socket.IO

### Messages

- `message_sent`
  - Émis par le serveur après création d'un message.
  - Payload : message hydraté complet.
- `message_delivered`
  - Émis quand un message est livré à au moins un destinataire connecté.
  - Payload : `{ conversation_id, message_id, delivered_at }`.
- `message_read`
  - Émis quand une conversation ou un message est lu.
  - Payload : `{ conversation_id, user_id, message_id?, last_message_id?, read_at }`.

Les anciens événements `message:new`, `message:read`, `message:edited` et `message:deleted` restent supportés.

### Typing

- `typing_start`
  - Client vers serveur : `{ conversation_id }`.
  - Serveur vers membres : `{ conversation_id, user_id, username, is_typing: true }`.
- `typing_stop`
  - Client vers serveur : `{ conversation_id }`.
  - Serveur vers membres : `{ conversation_id, user_id, username, is_typing: false }`.

L'ancien événement `typing` reste supporté pour compatibilité.

### Présence

- `user_online`
  - Payload : `{ user_id, status: "online" }`.
- `user_offline`
  - Payload : `{ user_id, status: "offline", last_seen }`.

L'ancien événement `presence:update` reste supporté.

### Messages épinglés

- `message_pinned`
  - Payload : message hydraté complet.
- `message_unpinned`
  - Payload : `{ id, conversation_id }`.

Seuls les membres `owner` ou `admin` d'un groupe peuvent épingler/désépingler.

### Réactions

- `reaction_added`
- `reaction_updated`
- `reaction_removed`

Payload : `{ message, user_id, reaction? }`.

Un utilisateur ne peut avoir qu'une seule réaction par message. Réactions autorisées : `👍 ❤️ 😂 😮 😢 🔥`.

### Groupes et notifications

- `group:added`
  - Émis vers `user:<id>` quand un utilisateur est ajouté à un groupe.
  - Payload : `{ conversation }`.

### Appels

Les événements WebRTC existants restent inchangés. Le frontend déclenche une notification navigateur sur `call:incoming`.

## Routes REST ajoutées

- `POST /api/messages/conversation/:id/read`
- `POST /api/messages/:id/pin`
- `DELETE /api/messages/:id/pin`
- `POST /api/messages/:id/reactions`
- `DELETE /api/messages/:id/reactions`
- `POST /api/upload/voice`

## Notes vocales

Le frontend utilise `MediaRecorder`.

Contraintes backend :

- formats MIME : `audio/webm`, `audio/mpeg`, `audio/mp3`, `audio/ogg`, `audio/opus`
- taille maximale : 10 MB
- durée maximale : 5 minutes

Le fichier est stocké par le système d'uploads existant dans `uploads/audio`.

## Compression images

Le frontend compresse avant upload :

- formats : `jpg`, `jpeg`, `png`, `webp`
- largeur/hauteur max : 1920 px
- qualité cible : 75 % à 85 %
- objectif : passer sous 1 MB quand possible

L'interface affiche la taille originale, la taille compressée et le pourcentage de réduction.

## Notifications navigateur

Le frontend utilise la Notification API si disponible et autorisée.

Notifications déclenchées quand l'onglet est inactif :

- nouveau message
- appel entrant
- ajout à un groupe

Le clic sur la notification focus la fenêtre et demande l'ouverture de la conversation.

## Tests manuels

1. Appliquer la migration SQL.
2. Redémarrer backend et frontend.
3. Ouvrir deux navigateurs ou profils différents.
4. Connecter deux utilisateurs différents.
5. Envoyer un message :
   - coche simple au départ
   - double coche grise si l'autre utilisateur est connecté
   - double coche bleue quand la conversation est ouverte/lue
6. Taper dans une conversation :
   - vérifier l'indicateur "est en train d'écrire..."
   - vérifier sa disparition automatique après inactivité
7. Fermer un onglet utilisateur :
   - vérifier badge hors ligne et dernière connexion
   - ouvrir deux onglets du même utilisateur et vérifier qu'il reste en ligne tant qu'un onglet reste connecté
8. Enregistrer une note vocale :
   - démarrer, arrêter, écouter, supprimer
   - envoyer et relire dans la conversation
9. Dans un groupe avec un admin :
   - épingler un message
   - vérifier la section en haut
   - cliquer pour revenir au message
   - désépingler
10. Ajouter une réaction :
   - vérifier compteur et liste au survol
   - changer de réaction
   - supprimer sa réaction
11. Mettre l'onglet en arrière-plan :
   - recevoir un message
   - recevoir un appel
   - être ajouté à un groupe
   - vérifier les notifications navigateur
12. Envoyer une grande image :
   - vérifier taille originale, taille compressée et réduction
   - vérifier que l'image envoyée s'affiche correctement

## Compatibilité

- Les événements historiques restent présents pour ne pas casser les composants existants.
- Les routes d'envoi, upload, conversations et appels existantes sont conservées.
- `message_reads` reste la source détaillée de lecture par utilisateur; `messages.read_at` indique quand tous les destinataires concernés ont lu le message.
- Les statuts `users.status` et `users.last_seen` existants sont conservés; `is_online` optimise l'affichage.
