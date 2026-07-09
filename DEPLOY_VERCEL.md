# Déploiement Senegram sur Vercel

## Architecture recommandée

| Composant | Plateforme | Pourquoi |
|-----------|-----------|----------|
| **Frontend (React/Vite)** | **Vercel** | ✅ Optimisé pour Vite/React |
| **Backend (Express + Socket.io + MySQL)** | **Railway / Render / Fly.io** | ✅ WebSockets + MySQL natif |

> ⚠️ **Vercel ne supporte pas WebSockets ni connexions DB persistantes** → Backend ne peut pas tourner sur Vercel.

---

## 1. Déployer le Backend (Railway recommandé)

### Option A: Railway (recommandé - gratuit avec $5/mois crédit)
```bash
# 1. Installer Railway CLI
npm i -g @railway/cli

# 2. Login & init
railway login
cd backend
railway init

# 3. Ajouter MySQL
railway add mysql

# 4. Configurer variables d'env (dans Railway dashboard)
# DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, PORT=3000, FRONTEND_URL=https://ton-app.vercel.app

# 5. Déployer
railway up
```

### Option B: Render (gratuit 750h/mois)
1. Connect GitHub → New Web Service
2. Build: `npm install` | Start: `npm start`
3. Add PostgreSQL (ou MySQL externe comme PlanetScale)
3. Variables d'env dans dashboard

---

## 2. Déployer le Frontend sur Vercel

### Via Dashboard (recommandé)
1. Push ton code sur GitHub
2. [vercel.com/new](https://vercel.com/new) → Import repo
3. **Root Directory**: `frontend`
4. **Framework Preset**: Vite
5. **Build Command**: `npm run build`
6. **Output Directory**: `dist`
7. **Environment Variables**:
   ```
   VITE_API_URL=https://ton-backend.railway.app
   VITE_SOCKET_URL=https://ton-backend.railway.app
   ```

### Via CLI
```bash
cd frontend
npx vercel --prod
```

---

## 3. Variables d'environnement

### Frontend (.env.production)
```env
VITE_API_URL=https://ton-backend.railway.app
VITE_SOCKET_URL=https://ton-backend.railway.app
```

### Backend (.env sur Railway/Render)
```env
DB_HOST=mysql.railway.internal
DB_USER=root
DB_PASSWORD=xxx
DB_NAME=senegram
JWT_SECRET=ton_secret_jwt
PORT=3000
FRONTEND_URL=https://ton-app.vercel.app
NODE_ENV=production
```

---

## 4. Config CORS Backend (backend/config/cors.js ou server.js)

```js
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
};
app.use(cors(corsOptions));
```

---

## 5. Mise à jour frontend API URL

Dans `frontend/src/services/api.js` :
```js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

Dans `frontend/src/services/socket.js` :
```js
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
```

---

## 5. Déploiement continu

Chaque `git push` sur `main` → Vercel redéploie auto le frontend.

Pour le backend sur Railway : `railway up` ou auto-deploy GitHub activé.

---

## Coûts estimés/mois
- **Vercel** : Gratuit (hobby)
- **Railway** : ~$5/mois (MySQL inclus)
- **Total** : ~$5/mois

---

## Alternative tout-en-un (si tu veux rester simple)
- **Render** : Backend + PostgreSQL gratuit (limité)
- **Fly.io** : Backend + DB gratuit (plus technique)
