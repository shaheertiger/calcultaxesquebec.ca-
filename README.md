# Calcul Taxes Québec

Calculatrice TPS/TVQ rapide, mobile-first et optimisée SEO pour le Québec.
Site statique (HTML/CSS/JS vanille, zéro framework au runtime) — chargement
instantané et excellents Core Web Vitals.

**Live :** https://www.calcultaxesquebec.ca/

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
| `/` | calcul taxes quebec, prix avec taxes, calcul tps / tvq (absorbe `/calcul-tps-tvq/`, `/calculateur-de-taxes-quebec/`, `/tps-tvq-en-ligne/`, `/tableau-tps-tvq-quebec/` via 301) |
| `/calcul-taxe-inverse-quebec/` | calcul taxes inversé / taxes inversées (absorbe `/prix-avant-taxes-quebec/` via 301) |
| `/calcul-salaire-net-quebec/` | calcul salaire net / salaire brut en net |
| `/calcul-paie-net-quebec/` | calcul paie net / simulation calcul paie |
| `/calcul-impot-quebec/` | calcul impôt québec / calculateur impôt |
| `/tranches-imposition-quebec/` | tranches / taux d'imposition québec |
| `/calcul-taxe-de-bienvenue-quebec/` | taxe de bienvenue |
| `/taux-tps-tvq-quebec/` | taux tps tvq |
| `/quebec-tax-calculator/` | quebec sales tax calculator (EN) |
| `/reverse-tax-calculator-quebec/` | reverse tax calculator quebec (EN) |
| `/quebec-income-tax-calculator/` | quebec income tax calculator (EN) |
| `/quebec-paycheck-calculator/` | quebec paycheck calculator (EN) |
| `/quebec-tax-brackets/` | quebec tax brackets (EN) |
| `/quebec-tax-rate/` | quebec tax rate / sales tax rate (EN) |
| `/quebec-welcome-tax-calculator/` | quebec welcome tax (EN) |
| `/calcul-taxes-canada/` | calcul taxes canada (toutes les provinces) |
| `/canada-sales-tax-calculator/` | canada sales tax calculator (EN) |
| `/calcul-taxes-ontario/` | calcul taxes ontario / taxe ontario |
| `/ontario-sales-tax-calculator/` | ontario taxes / ontario sales tax (EN) |
| `/gst-calculator/` | gst calculator / gst calculator alberta / reverse gst (EN) |
| `/hst-calculator/` | hst calculator / reverse hst calculator, 13-14-15 % (EN) |
| `/gst-pst-calculator/` | gst pst calculator / gst calculator bc, manitoba, saskatchewan (EN) |
| `/methode-rapide-tps-tvq/` | méthode rapide tps tvq / déclaration et remise tps tvq (moteur : `assets/js/rapide.js`) |
| `/taxe-vehicule-occasion-quebec/` | taxe voiture usagée, vente privée SAAQ |
| `/taxes-achats-en-ligne-quebec/` | taxes achat en ligne, amazon, colis états-unis |
| `/taxe-hebergement-quebec/` | taxe d'hébergement 3,5 %, hôtel, airbnb |
| `/recuperer-tps-tvq-cti-rti/` | CTI RTI, récupérer tps tvq |
| `/what-is-the-tax-in-quebec/` | what is the tax in quebec (guide EN, paire de `/taxe-quebec-2026/`) |
| `/calcul-tps-quebec/` | calcul tps / tps seule / tps incluse |
| `/calcul-tvq-quebec/` | calcul tvq / taux tvq / tvq incluse |
| `/calcul-pourboire-quebec/` | calcul pourboire / pourboire avant ou après taxes (moteur : `assets/js/pourboire.js`) |
| `/historique-taux-tps-tvq/` | tps tvq 2025, 2024, 2023 / historique des taux |
| `/1-14975-taxes-quebec/` | 1,14975 / multiplicateur des taxes |
| `/tps-tvq-calculator/` | tps tvq calculator (EN) |
| `/calcul-taxes-nouveau-brunswick/` | calcul taxes nouveau-brunswick (TVH 15 %) |
| `/calcul-taxes-nouvelle-ecosse/` | calcul taxes nouvelle-écosse (TVH 14 %) |
| `/calcul-taxes-alberta/` | calcul taxes alberta (TPS 5 %) |
| `/calcul-taxes-colombie-britannique/` | calcul taxes colombie-britannique (TPS + TVP 12 %) |

Les tableaux des pages impôt/paie sont calculés au build par le même moteur que la
calculatrice (`assets/js/salary.js`, exporté pour Node) : modifiez les paramètres
2026 à un seul endroit.

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

## Calculatrice de salaire net (brut → net)

`/calcul-salaire-net-quebec/` estime la paie nette d'un salarié québécois à partir du
salaire brut. Le moteur (`assets/js/salary.js`) applique les **paramètres 2026** :

| Élément | Valeur 2026 |
|---------|-------------|
| RRQ — exemption / MGA / MSGA | 3 500 $ / 74 600 $ / 85 000 $ |
| RRQ — taux (base + 1er suppl.) / RRQ2 | 5,30 % + 1,00 % = 6,30 % / 4,00 % |
| Assurance-emploi (Québec) | 1,30 % jusqu'à 68 900 $ |
| RQAP (salarié) | 0,430 % jusqu'à 103 000 $ |
| Impôt fédéral | 14 / 20,5 / 26 / 29 / 33 % (paliers 58 523 / 117 045 / 181 440 / 258 482 $) |
| Montant personnel de base fédéral | 16 452 $ (min. 14 829 $), abattement Québec 16,5 % |
| Montant canadien pour emploi | 1 501 $ |
| Impôt du Québec | 14 / 19 / 24 / 25,75 % (paliers 54 345 / 108 680 / 132 245 $) |
| Montant personnel de base — Québec | 18 952 $ |

C'est une **estimation** (particulier salarié, revenu d'emploi, crédits de base ; sans
REER, avantages imposables ni crédits familiaux). Sources : Retraite Québec / Revenu
Québec (RRQ, RQAP), Canada.ca (assurance-emploi, impôt fédéral), TaxTips.ca (paliers
2026). Mettez à jour les constantes de `salary.js` (et la table de `build.js`) à chaque
indexation annuelle.

## SEO Bing / IndexNow

Le site suit les recommandations des Bing Webmaster Guidelines&nbsp;:

- **robots.txt** accueille explicitement `Bingbot` et déclare le sitemap.
- **Balise robots** : `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1`.
- **Données structurées** Schema.org (WebApplication, FAQ, BreadcrumbList…), reconnues par Bing.
- **IndexNow** : la clé est servie à la racine (`/74d5a7f9a4cb4affadf38a391aa7dcff.txt`).
  Après un déploiement, notifiez Bing instantanément :

  ```bash
  node build.js                 # régénère le sitemap
  node scripts/indexnow.js      # soumet toutes les URLs du sitemap à IndexNow
  node scripts/indexnow.js /tps-tvq-en-ligne/   # ou seulement certaines pages
  ```

- **Vérification Bing Webmaster Tools** : collez votre code dans la constante
  `BING_VERIFICATION` de `build.js` puis relancez `node build.js` pour émettre la
  balise `msvalidate.01` sur toutes les pages.

## Taux utilisés

- TPS : 5 %
- TVQ : 9,975 % (calculée sur le prix de vente **avant** taxes, pas sur la TPS)
- Taux combiné : 14,975 %
- Calcul inverse : `montant avant taxes = total / 1,14975`

Les montants affichés sont arrondis au cent près. Dernière mise à jour : 2026.
