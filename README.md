# Mes mots d'anglais

Cartes mémoire pour apprendre les **3000 mots anglais les plus utiles**, du plus fréquent au
plus rare. Révision espacée (Leitner), 100 % côté client, sans compte. Progression stockée
dans le navigateur.

## Lancer en local

```bash
python3 -m http.server 8000
# ouvrir http://localhost:8000
```

(Un serveur HTTP est nécessaire : la page `fetch()` ses données, donc pas en `file://`.)

## Structure

- `index.html` — l'appli, statique, sans build.
- `data/words.json` — les 3000 mots (6 paliers de 500).
- `data/verbs.json` — deck bonus des verbes irréguliers au passé.

Voir [CLAUDE.md](CLAUDE.md) pour le détail (format des données, SRS, déploiement).

## Déploiement

GitHub Pages, depuis la racine de la branche. Aucun build.
