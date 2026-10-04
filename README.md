# BRISEUR DE HAINE — TÉMOIGNAGES

Site statique autonome dédié au sondage, aux témoignages et aux signalements anonymes. HTML, CSS et JavaScript natifs, sans dépendance, sans installation et sans étape de compilation.

## Production

- Dépôt GitHub dédié : `briseur-de-haine-temoignages`.
- Projet Vercel dédié : `briseur-de-haine-temoignages`.
- Domaine prévu : `temoignages.briseurdehaine.fr`.
- Administration : `/?admin=1`, puis connexion avec le mot de passe administrateur configuré dans le backend.

Importer uniquement ce dépôt dans le nouveau projet Vercel, avec le preset « Other ». Le fichier `vercel.json` configure le contenu statique et les en-têtes de sécurité. Aucun secret ni variable d’environnement n’est nécessaire au frontend.

## Backend conservé

Toutes les requêtes du frontend utilisent exclusivement `https://khzfsdwxmvnsqziufkef.supabase.co/functions/v1/bdh-api`, en POST JSON. Actions : `stats`, `vote`, `submission`, `admin_login`, `admin_list`, `admin_action`, `admin_logout`.

Le mot de passe n’est ni codé ni sauvegardé dans les fichiers. Il est saisi dans le formulaire d’administration et transmis uniquement à l’API existante par HTTPS. Le jeton de session reste en mémoire ; recharger la page nécessite une reconnexion.

## Fonctionnement

- Sondage Oui / Non, statistiques et blocage simple du vote par navigateur avec localStorage. Ce mécanisme ne garantit pas un vote unique par personne ; si le stockage est désactivé, le blocage est limité à l’onglet courant.
- Messages de 10 à 5 000 caractères ; types témoignage, signalement ou autre ; honeypot invisible. Aucune identité ni adresse email demandée.
- Administration avec statistiques, filtres Tous / Nouveaux / Lus / Archivés, message complet, date et référence ID. Actions Lu / Archiver / Supprimer avec confirmation avant suppression.
- Export CSV du filtre actuel, en UTF-8 avec BOM, séparateur point-virgule, texte intégral et protection contre l’interprétation des cellules comme formules.
- Affichage mobile, navigation clavier, focus visible et annonces de résultat accessibles. Messages rendus comme texte pour empêcher l’injection HTML.

## Confidentialité

Aucune identité ni adresse IP n’est enregistrée dans la base applicative. L’hébergeur peut néanmoins traiter temporairement des métadonnées techniques dans ses journaux de sécurité. Le contenu libre peut contenir des informations fournies volontairement par son auteur : la page recommande d’éviter les détails identifiants.

## Prévisualisation locale

Depuis ce dossier : `python3 -m http.server 8080`. Ouvrir `http://localhost:8080` ; le frontend appelle le backend réel. Ne pas ouvrir `index.html` en mode `file://`.

## Vérification après déploiement

Ouvrir la page publique ; vérifier les statistiques ; voter une fois ; confirmer le blocage après rechargement ; envoyer un message de test identifié ; se connecter dans l’administration ; retrouver le message ; exporter le CSV ; marquer Lu ; archiver ; supprimer uniquement le message de test ; se déconnecter ; vérifier l’affichage mobile. Les données réelles doivent rester intactes.
