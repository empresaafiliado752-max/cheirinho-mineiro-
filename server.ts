import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any;
try {
  const dbPath = path.join(__dirname, "recipes_v2.db");
  console.log(`Using database at: ${dbPath}`);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.error("Failed to initialize database file, falling back to memory:", err);
  db = new Database(":memory:");
}

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    ingredients TEXT, -- JSON array
    steps TEXT,       -- JSON array
    difficulty TEXT,
    prep_time TEXT,
    equipment TEXT,   -- JSON array
    image_url TEXT,
    category TEXT,
    is_brazilian INTEGER DEFAULT 0,
    country TEXT,
    history TEXT
  );

  CREATE TABLE IF NOT EXISTS dev_overrides (
    recipe_id INTEGER PRIMARY KEY,
    image_url TEXT,
    FOREIGN KEY(recipe_id) REFERENCES recipes(id)
  );
`);

// Migration for existing databases
try {
  db.exec("ALTER TABLE recipes ADD COLUMN country TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE recipes ADD COLUMN history TEXT");
} catch (e) {}

function seedDatabase() {
  console.log("Checking if database needs seeding...");
  const rowCount = db.prepare("SELECT COUNT(*) as count FROM recipes").get() as { count: number };
  console.log(`Current recipe count: ${rowCount.count}`);
  if (rowCount.count > 0) return;

  console.log("Database is empty. Seeding initial recipes...");
  const initialRecipes = [
    {
      name: "Café Coado no Pano",
      description: "O clássico brasileiro, com sabor de casa e tradição mineira.",
      ingredients: JSON.stringify(["2 colheres de sopa de café moído médio", "200ml de água filtrada"]),
      steps: JSON.stringify(["Aqueça a água até quase ferver", "Escalde o coador de pano", "Coloque o café no coador", "Despeje a água em movimentos circulares"]),
      difficulty: "Fácil",
      prep_time: "5 min",
      equipment: JSON.stringify(["Coador de pano", "Suporte para coador", "Chaleira"]),
      image_url: "https://picsum.photos/seed/coado/800/600",
      category: "Tradicional",
      is_brazilian: 1
    },
    {
      name: "Cappuccino Italiano",
      description: "Equilíbrio perfeito entre espresso, leite vaporizado e espuma cremosa.",
      ingredients: JSON.stringify(["1 dose de espresso (30ml)", "100ml de leite integral", "Cacau em pó para polvilhar"]),
      steps: JSON.stringify(["Prepare o espresso", "Vaporize o leite até criar uma espuma densa", "Despeje o leite sobre o café", "Finalize com a espuma e cacau"]),
      difficulty: "Média",
      prep_time: "10 min",
      equipment: JSON.stringify(["Máquina de espresso", "Pitcher (jarra de leite)"]),
      image_url: "https://picsum.photos/seed/cappuccino/800/600",
      category: "Mundial",
      is_brazilian: 0
    },
    {
      name: "Cold Brew com Laranja",
      description: "Refrescante e cítrico, ideal para dias quentes de verão.",
      ingredients: JSON.stringify(["50g de café moído grosso", "500ml de água fria", "Rodelas de laranja", "Gelo"]),
      steps: JSON.stringify(["Misture o café e a água", "Deixe em infusão na geladeira por 12-18 horas", "Filtre o café", "Sirva com gelo e rodelas de laranja"]),
      difficulty: "Fácil",
      prep_time: "12h",
      equipment: JSON.stringify(["Pote de vidro", "Filtro de papel ou prensa francesa"]),
      image_url: "https://picsum.photos/seed/coldbrew/800/600",
      category: "Gelado",
      is_brazilian: 0
    },
    {
      name: "Affogato al Caffè",
      description: "Uma sobremesa sofisticada que une o calor do espresso ao gelado do sorvete.",
      ingredients: JSON.stringify(["1 dose de espresso quente", "1 bola de sorvete de baunilha", "Amêndoas laminadas (opcional)"]),
      steps: JSON.stringify(["Coloque a bola de sorvete em uma taça", "Prepare o espresso", "Despeje o café quente sobre o sorvete", "Sirva imediatamente"]),
      difficulty: "Fácil",
      prep_time: "3 min",
      equipment: JSON.stringify(["Máquina de espresso", "Taça de sobremesa"]),
      image_url: "https://picsum.photos/seed/affogato/800/600",
      category: "Especial",
      is_brazilian: 0
    },
    {
      name: "Café com Leite e Canela",
      description: "O conforto matinal brasileiro com um toque aromático de canela.",
      ingredients: JSON.stringify(["150ml de café coado forte", "150ml de leite quente", "1 pau de canela", "Canela em pó"]),
      steps: JSON.stringify(["Aqueça o leite com o pau de canela", "Prepare o café", "Misture os dois em uma caneca", "Polvilhe canela em pó por cima"]),
      difficulty: "Fácil",
      prep_time: "5 min",
      equipment: JSON.stringify(["Caneca", "Leiteira"]),
      image_url: "https://picsum.photos/seed/leitecanela/800/600",
      category: "Tradicional",
      is_brazilian: 1
    },
    {
      name: "Hario V60 Floral",
      description: "Método japonês que ressalta as notas acídicas e florais de cafés especiais.",
      ingredients: JSON.stringify(["20g de café especial moagem média-fina", "300ml de água a 92°C"]),
      steps: JSON.stringify(["Escalde o filtro de papel", "Adicione o café", "Faça a pré-infusão por 30s", "Despeje o restante da água lentamente"]),
      difficulty: "Média",
      prep_time: "4 min",
      equipment: JSON.stringify(["Hario V60", "Filtro de papel", "Chaleira bico de ganso"]),
      image_url: "https://picsum.photos/seed/v60/800/600",
      category: "Mundial",
      is_brazilian: 0
    },
    {
      name: "Mocaccino Caseiro",
      description: "A doçura do chocolate combinada com a intensidade do café.",
      ingredients: JSON.stringify(["1 dose de café forte", "100ml de leite vaporizado", "2 colheres de calda de chocolate"]),
      steps: JSON.stringify(["Coloque a calda no fundo da xícara", "Adicione o café", "Finalize com o leite vaporizado e espuma"]),
      difficulty: "Fácil",
      prep_time: "7 min",
      equipment: JSON.stringify(["Xícara", "Espumador de leite"]),
      image_url: "https://picsum.photos/seed/mocha/800/600",
      category: "Especial",
      is_brazilian: 0
    }
  ];

  const insert = db.prepare(`
    INSERT INTO recipes (name, description, ingredients, steps, difficulty, prep_time, equipment, image_url, category, is_brazilian)
    VALUES (@name, @description, @ingredients, @steps, @difficulty, @prep_time, @equipment, @image_url, @category, @is_brazilian)
  `);

  for (const recipe of initialRecipes) {
    try {
      insert.run(recipe);
    } catch (err) {
      console.error(`Failed to insert recipe ${recipe.name}:`, err);
    }
  }
  console.log("Seeding finished.");
}

seedDatabase();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  app.get("/api/ping", (req, res) => {
    res.json({ status: "pong", time: new Date().toISOString() });
  });

  // Debug Route
  app.get("/api/dev/debug-db", (req, res) => {
    try {
      const recipes = db.prepare("SELECT * FROM recipes").all();
      res.json({ count: recipes.length, recipes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/dev/seed", (req, res) => {
    try {
      if (req.query.force === 'true') {
        db.prepare("DELETE FROM recipes").run();
        db.prepare("DELETE FROM dev_overrides").run();
      }
      seedDatabase();
      const rowCount = db.prepare("SELECT COUNT(*) as count FROM recipes").get() as { count: number };
      res.json({ message: "Seed process completed", count: rowCount.count });
    } catch (err) {
      res.status(500).json({ error: "Seed failed", details: err.message });
    }
  });

  // API Routes
  app.get("/api/recipes", (req, res) => {
    const { search, category, equipment } = req.query;
    let query = `
      SELECT r.*, COALESCE(o.image_url, r.image_url) as display_image 
      FROM recipes r
      LEFT JOIN dev_overrides o ON r.id = o.recipe_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (r.name LIKE ? OR r.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      query += ` AND r.category = ?`;
      params.push(category);
    }

    console.log(`Executing query: ${query} with params:`, params);
    const recipes = db.prepare(query).all(...params);
    console.log(`Found ${recipes.length} recipes in DB`);
    
    // Parse JSON fields with error handling
    const parsedRecipes = recipes.map((r: any) => {
      try {
        return {
          ...r,
          ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : (r.ingredients || []),
          steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : (r.steps || []),
          equipment: typeof r.equipment === 'string' ? JSON.parse(r.equipment) : (r.equipment || []),
          is_brazilian: !!r.is_brazilian
        };
      } catch (e) {
        console.error(`Error parsing recipe ${r.id}:`, e);
        return null;
      }
    }).filter(r => r !== null);

    console.log(`Returning ${parsedRecipes.length} parsed recipes`);
    res.json(parsedRecipes);
  });

  app.get("/api/recipes/:id", (req, res) => {
    const recipe = db.prepare(`
      SELECT r.*, COALESCE(o.image_url, r.image_url) as display_image 
      FROM recipes r
      LEFT JOIN dev_overrides o ON r.id = o.recipe_id
      WHERE r.id = ?
    `).get(req.params.id) as any;

    if (!recipe) return res.status(404).json({ error: "Recipe not found" });

    res.json({
      ...recipe,
      ingredients: JSON.parse(recipe.ingredients),
      steps: JSON.parse(recipe.steps),
      equipment: JSON.parse(recipe.equipment),
      is_brazilian: !!recipe.is_brazilian
    });
  });

  // Create Recipe
  app.post("/api/recipes", (req, res) => {
    const { name, description, ingredients, steps, difficulty, prep_time, equipment, image_url, category, is_brazilian, country, history } = req.body;
    
    if (!name) return res.status(400).json({ error: "Name is required" });

    try {
      const stmt = db.prepare(`
        INSERT INTO recipes (name, description, ingredients, steps, difficulty, prep_time, equipment, image_url, category, is_brazilian, country, history)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        name, 
        description || "", 
        JSON.stringify(ingredients || []), 
        JSON.stringify(steps || []), 
        difficulty || "Fácil", 
        prep_time || "5 min", 
        JSON.stringify(equipment || []), 
        image_url || "https://picsum.photos/seed/coffee/800/600", 
        category || "Tradicional", 
        is_brazilian ? 1 : 0,
        country || "",
        history || ""
      );

      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: "Failed to create recipe" });
    }
  });

  // Update Recipe
  app.put("/api/recipes/:id", (req, res) => {
    const { id } = req.params;
    const { name, description, ingredients, steps, difficulty, prep_time, equipment, category, is_brazilian, country, history } = req.body;
    
    if (!name) return res.status(400).json({ error: "Name is required" });

    try {
      const stmt = db.prepare(`
        UPDATE recipes 
        SET name = ?, description = ?, ingredients = ?, steps = ?, difficulty = ?, prep_time = ?, equipment = ?, category = ?, is_brazilian = ?, country = ?, history = ?
        WHERE id = ?
      `);
      
      stmt.run(
        name, 
        description || "", 
        JSON.stringify(ingredients || []), 
        JSON.stringify(steps || []), 
        difficulty || "Fácil", 
        prep_time || "5 min", 
        JSON.stringify(equipment || []), 
        category || "Tradicional", 
        is_brazilian ? 1 : 0,
        country || "",
        history || "",
        id
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update recipe" });
    }
  });

  // Dev Mode: Override Image
  app.post("/api/dev/override-image", (req, res) => {
    const { recipeId, imageUrl } = req.body;
    if (!recipeId || !imageUrl) return res.status(400).json({ error: "Missing fields" });

    const stmt = db.prepare(`
      INSERT INTO dev_overrides (recipe_id, image_url)
      VALUES (?, ?)
      ON CONFLICT(recipe_id) DO UPDATE SET image_url = excluded.image_url
    `);
    stmt.run(recipeId, imageUrl);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully initialized and running on http://localhost:${PORT}`);
  });
}

startServer();
