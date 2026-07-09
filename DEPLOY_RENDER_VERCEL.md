# Déploiement Senegram : Frontend (Vercel) + Backend (Render)

## Architecture
| Composant | Plateforme | Pourquoi |
|-----------|-----------|----------|
| **Frontend (React/Vite)** | **Vercel** | Gratuit, optimisé Vite/React, CI/CD auto |
| **Backend (Node/Express/Socket.io + MySQL)** | **Render** | WebSockets natifs, DB managée, 750h/mois gratuit |

⚠️ **Important** : Render Free tier = 750h/mois (s'éteint après 15min inactivité). Pour production → passez à **Starter $7/mois** (always on).

---

## 1. Préparer le Backend pour Render

### A. Créer `render.yaml` (racine du repo)
```yaml
# render.yaml (à la racine du repo)
services:
  - type: web
    name: senegram-backend
    env: node
    region: frankfurt  # ou oregon/singapore
    plan: free  # ou starter pour production
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: FRONTEND_URL
        value: https://TON_APP.vercel.app
      - key: JWT_SECRET
        generateValue: true
      - key: DB_HOST
        fromDatabase:
          name: senegram-db
          property: host
      - key: DB_USER
        fromDatabase:
          name: senegram-db
          property: user
      - key: DB_PASSWORD
        fromDatabase:
          name: senegram-db
          property: password
      - key: DB_NAME
        fromDatabase:
          name: senegram-db
          property: database

databases:
  - name: senegram-db
    databaseName: senegram
    user: senegram
    plan: free
    region: frankfurt
```

### B. Modifier `backend/package.json`
```json
{
  "scripts": {
    "start": "node server.js",
    "db:init": "node scripts/init-db.js"
  }
}
```

### C. Ajouter health check dans `backend/server.js`
```js
app.get('/health', (req, res) => res.send('OK'));
```

### C. Config CORS pour Vercel
```js
// backend/server.js ou backend/config/cors.js
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
};
app.use(cors(corsOptions));
```

### D. Config Socket.io pour Render
```js
// backend/sockets/index.js
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }
});
```

---

## 2. Préparer le Frontend pour Vercel

### A. `frontend/vercel.json` (déjà créé)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### B. `frontend/.env.production`
```env
VITE_API_URL=https://senegram-backend.onrender.com/api
VITE_SOCKET_URL=https://senegram-backend.onrender.com
```

### C. Mettre à jour les services frontend
```js
// frontend/src/services/api.js
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// frontend/src/services/socket.js
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
```

---

## 3. Déployer sur Render (Backend)

### Via Dashboard (recommandé)
1. **Connect GitHub** → New → **Blueprint** → Select repo → `render.yaml`
2. Render détecte `render.yaml` → crée service + DB automatiquement
3. **Variables d'env** : Render les injecte depuis `fromDatabase` et `generateValue`
4. **Deploy** → attend build + deploy

### Via CLI (alternatif)
```bash
npm i -g @render/cli
render login
# Puis pousse ton code, Render auto-deploie via render.yaml
```

---

## 4. Déployer sur Vercel (Frontend)

### Via Dashboard
1. [vercel.com/new](https://vercel.com/new) → Import GitHub repo
2. **Framework**: Vite
3. **Root Directory**: `frontend`
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. **Environment Variables**:
   ```
   VITE_API_URL=https://senegram-backend.onrender.com/api
   VITE_SOCKET_URL=https://senegram-backend.onrender.com
   ```
7. **Deploy**

### Via CLI
```bash
cd frontend
npx vercel --prod
```

---

## 5. Connecter Frontend ↔ Backend

1. **Récupère l'URL Render** : `https://senegram-backend.onrender.com`
2. **Update Vercel env vars** avec cette URL
3. **Redeploy Vercel** (Settings → Deployments → Redeploy)

---

## 6. Initialiser la Base de Données

### Option A: Via Render Shell (recommandé)
1. Render Dashboard → ton service → **Shell**
2. `npm run db:init`

### Option B: Script dans render.yaml (preDeploy)
```yaml
preDeployCommand: npm run db:init
```

---

## 7. Variables d'Environnement Résumé

| Variable | Où | Valeur |
|----------|-----|--------|
| `VITE_API_URL` | Vercel | `https://TON_BACKEND.onrender.com/api` |
| `VITE_SOCKET_URL` | Vercel | `https://TON_BACKEND.onrender.com` |
| `FRONTEND_URL` | Render | `https://TON_APP.vercel.app` |
| `JWT_SECRET` | Render | Auto-généré (`generateValue: true`) |
| `DB_*` | Render | Auto-injecté depuis DB managée |

---

## 8. Problèmes Courants & Fixes

| Problème | Solution |
|----------|----------|
| **CORS Error** | Vérifie `FRONTEND_URL` sur Render = URL Vercel exacte |
| **WebSocket disconnected** | Render Free s'endort → Upgrade Starter $7/mo ou ping externe |
| **DB Connection refused** | Vérifie `render.yaml` : `fromDatabase` reference correct |
| **Build fail frontend** | Vérifie `VITE_API_URL` défini dans Vercel env vars |
| **Socket.io 400/404** | Vérifie `path: '/socket.io'` côté client & serveur |

---

## 9. Coûts Mensuels Estimés

| Plan | Coût | Limites |
|------|------|---------|
| **Vercel Hobby** | **Gratuit** | 100GB bandwidth, builds illimités |
| **Render Free** | **Gratuit** | 750h/mois, s'endort après 15min inactivité |
| **Render Starter** | **$7/mois** | Always on, custom domains, 512MB RAM |
| **Total Prod** | **$7/mois** | Recommandé pour production |

---

## 10. Commandes Utiles

```bash
# Voir logs Render
render logs senegram-backend --tail

# Redéployer Render
render deploy senegram-backend

# Vérifier DB
render psql senegram-db

# Vercel logs
vercel logs TON_DEPLOYMENT_URL
```

---

## Checklist Pré-Déploiement

- [ ] `render.yaml` à la racine du repo
- [ ] `backend/server.js` : health check `/health` + CORS config
- [ ] `backend/sockets/index.js` : CORS Socket.io configuré
- [ ] `frontend/vercel.json` créé
- [ ] `frontend/.env.production` avec URLs Render
- [ ] `frontend/src/services/api.js` & `socket.js` utilisent `import.meta.env`
- [ ] `backend/package.json` : `"start": "node server.js"`
- [ ] Push sur `main` → GitHub
- [ ] Render Blueprint deploy
- [ ] Vercel import + env vars
- [ ] Test complet : auth, chat, WebSocket, upload
