# Next.js Authentication API with Prisma & PostgreSQL

This project is a backend for user authentication using **Next.js API routes**, **Prisma ORM**, and **PostgreSQL**.

## 🚀 Setup & Installation

### 1️⃣ Clone the Repository

```sh
git clone https://github.com/your-repo/nextjs-auth-backend.git
cd nextjs-auth-backend
```

### 2️⃣ Install Dependencies

```sh
npm install
```

### 3️⃣ Configure Environment Variables

Create a `.env` file in the root folder and add your **PostgreSQL database URL**:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydatabase"
JWT_SECRET="your-secret-key"
```

Replace `user`, `password`, `localhost`, `5432`, and `mydatabase` with actual database details.

### 4️⃣ Initialize Prisma

```sh
npx prisma init
```

This creates the `prisma/` folder with a `schema.prisma` file.


### 6️⃣ Run Database Migration

```sh
npx prisma migrate dev --name init
```

This applies the schema changes to the database.

### 7️⃣ Generate Prisma Client

```sh
npx prisma generate
```

---

## 🚀 Running the Server

Start the development server:

```sh
npm run dev
```

The server will run on `http://localhost:3001`.

---

## 🔧 Available Scripts

### **Start Development Server**

```sh
npm run dev
```

Runs the server on **[http://localhost:3001](http://localhost:3001)**.

### **Build & Start Production Server**

```sh
npm run build && npm run start
```

### **Run Migrations**

```sh
npm run migrate
```