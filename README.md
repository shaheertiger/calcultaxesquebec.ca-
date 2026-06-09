# Calcul Taxes Québec

Calculatrice TPS/TVQ rapide, mobile-first et optimisée SEO pour le Québec.
Site statique (HTML/CSS/JS vanille, zéro framework au runtime) — chargement
instantané et excellents Core Web Vitals.

**Live :** https://calcultaxesquebec.ca

## Fonctionnalités

- Ajouter **ou** retirer les taxes (calcul inverse) — TPS 5 %, TVQ 9,975 %, combiné 14,975 %
- Calcul instantané pendant la frappe, format québécois (`100,00 $`, `1 000,00 $`)
- Accepte la virgule **ou** le point, entrée numérique mobile (`inputmode="decimal"`)
- Copier le résultat, effacer, montants rapides
- Version française (par défaut) + version anglaise
- PWA installable et utilisable hors-ligne (service worker)
- Contenu rendu côté serveur (indexable), schémas JSON-LD, sitemap, robots, OG/Twitter

## Pages

| URL | Mot-clé principal |
|-----|-------------------|
| `/` | calcul taxes quebec |
| `/calcul-tps-tvq/` | calcul tps tvq |
| `/calcul-taxe-inverse-quebec/` | calcul taxe inverse |
| `/quebec-tax-calculator/` | tax calculator quebec (EN) |
| `/taux-tps-tvq-quebec/` | taux tps tvq |

## Structure

```
build.js                  Générateur statique (pages + sitemap + robots)
assets/css/styles.css     Styles (mobile-first)
assets/js/calculator.js   Moteur de calcul + enregistrement du service worker
manifest.webmanifest      Manifeste PWA
sw.js                     Service worker (offline)
favicon.svg / icons/      Icônes + image Open Graph
index.html, */index.html  Pages générées (committées pour déploiement statique)
```

## Développement

Le HTML des pages est **généré** par `build.js`. Pour modifier le contenu,
éditez `build.js` (et les partials/contenu qu'il contient), puis :

```bash
node build.js        # régénère toutes les pages + sitemap.xml + robots.txt
```

Les icônes PWA et l'image OG sont générées par les scripts dans `scripts/`
(voir `scripts/genicons.py` et `scripts/genog.py`).

## Aperçu local

N'importe quel serveur statique convient. Exemple :

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

> Servez depuis la racine pour que les chemins absolus (`/assets/...`,
> `/sw.js`, `/manifest.webmanifest`) fonctionnent.

## Déploiement

Déployez le contenu de ce dossier tel quel sur n'importe quel hébergeur
statique (Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3…). Aucune étape
de build n'est requise côté serveur.

## Taux utilisés

- TPS : 5 %
- TVQ : 9,975 % (calculée sur le prix de vente **avant** taxes, pas sur la TPS)
- Taux combiné : 14,975 %
- Calcul inverse : `montant avant taxes = total / 1,14975`

Les montants affichés sont arrondis au cent près. Dernière mise à jour : 2026.
