# 🏗️ Vendor Evaluation System

מערכת להערכה אוטומטית של מציעים במכרז לחילוץ מידע ממסמכי נדל"ן (היתרי בנייה מילוליים).

---

## 📁 מבנה הפרויקט

```
vendor-evaluation-system/
├── backend/              # Node.js + Express + MongoDB
├── frontend/            # React + Tailwind CSS
├── docs/                # תיעוד מפורט
├── examples/            # קבצי דוגמה
├── scripts/             # סקריפטים עזר
└── README.md
```

---

## 🚀 התקנה והפעלה

### 1. דרישות
- Node.js 18+
- MongoDB Atlas (חינם) - [מדריך התקנה](docs/MONGODB_INSTALL.md)

### 2. התקנת Dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. הגדרת MongoDB
ערוך את `backend/.env`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/vendor_evaluation
PORT=5000
CORS_ORIGIN=http://localhost:3000
```

### 4. הפעלה
```bash
# Terminal 1
cd backend && npm start

# Terminal 2
cd frontend && npm start
```

פתח: **http://localhost:3000**

---

## 📊 שימוש מהיר

### 1. טען Ground Truth
```bash
./scripts/load-ground-truth.sh
```

### 2. העלה תוצאות מציע
- הכן ZIP עם קבצי JSON
- העלה דרך הממשק
- הציונים מחושבים אוטומטית!

**פורמט JSON:** ראה [examples/](examples/) ו-[PERMIT_ONLY_GUIDE.md](docs/PERMIT_ONLY_GUIDE.md)

---

## 🧮 חישוב ציונים

- **דיוק:** 0-100% (Accuracy + Jaccard Similarity)
- **זמן:** 0-30 (Time Score = 30 × (T_min/T_vendor)³)
- **סה"כ:** 0-130

**הסבר מפורט:** [SCORING_EXAMPLE.md](docs/SCORING_EXAMPLE.md)

---

## 📚 תיעוד

- [מדריך שימוש](docs/PERMIT_ONLY_GUIDE.md)
- [הסבר חישוב ציונים](docs/SCORING_EXAMPLE.md)
- [התקנת MongoDB Atlas](docs/MONGODB_INSTALL.md)

---

## 🛠️ טכנולוגיות

**Backend:** Node.js, Express, MongoDB, Mongoose  
**Frontend:** React 18, Tailwind CSS, Axios

---

**מערכת מוכנה לשימוש!** 🎉
