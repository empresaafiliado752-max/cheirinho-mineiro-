import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase environment variables are missing. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  app.get("/api/dev/debug-db", async (req, res) => {
    try {
      const { data, error } = await supabase.from('recipes').select('*');
      if (error) throw error;
      res.json({ count: data.length, recipes: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Routes
  app.get("/api/recipes", async (req, res) => {
    const { search, category } = req.query;
    console.log("GET /api/recipes: Fetching recipes from Supabase...");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("GET /api/recipes: Supabase credentials missing!");
      return res.status(500).json({ error: "Supabase credentials not configured in environment" });
    }

    try {
      let query = supabase.from('recipes').select('*');

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query.order('name');
      
      if (error) {
        console.error("GET /api/recipes: Supabase error:", error);
        throw error;
      }

      console.log(`GET /api/recipes: Supabase returned ${data?.length || 0} raw rows`);

      if (!data || data.length === 0) {
        console.warn("GET /api/recipes: No data found in 'recipes' table. Check RLS policies or if table is empty.");
        return res.json([]);
      }

      const parsedRecipes = data.map((r: any) => {
        try {
          return {
            ...r,
            ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : (r.ingredients || []),
            steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : (r.steps || []),
            equipment: typeof r.equipment === 'string' ? JSON.parse(r.equipment) : (r.equipment || []),
            is_brazilian: !!r.is_brazilian,
            display_image: r.image_url
          };
        } catch (e) {
          console.error(`GET /api/recipes: Error parsing recipe ${r.id}:`, e);
          // If parsing fails, try to return the raw data if it's already an object
          return {
            ...r,
            ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
            steps: Array.isArray(r.steps) ? r.steps : [],
            equipment: Array.isArray(r.equipment) ? r.equipment : [],
            is_brazilian: !!r.is_brazilian,
            display_image: r.image_url
          };
        }
      }).filter(r => r !== null);

      console.log(`GET /api/recipes: Returning ${parsedRecipes.length} parsed recipes`);
      res.json(parsedRecipes);
    } catch (err) {
      console.error("GET /api/recipes: Failed to fetch recipes:", err);
      res.status(500).json({ error: "Failed to fetch recipes", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Recipe not found" });

      res.json({
        ...data,
        ingredients: typeof data.ingredients === 'string' ? JSON.parse(data.ingredients) : (data.ingredients || []),
        steps: typeof data.steps === 'string' ? JSON.parse(data.steps) : (data.steps || []),
        equipment: typeof data.equipment === 'string' ? JSON.parse(data.equipment) : (data.equipment || []),
        is_brazilian: !!data.is_brazilian,
        display_image: data.image_url
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch recipe" });
    }
  });

  // Create Recipe
  app.post("/api/recipes", async (req, res) => {
    const { name, description, ingredients, steps, difficulty, prep_time, equipment, image_url, category, is_brazilian, country, history } = req.body;
    
    if (!name) return res.status(400).json({ error: "Name is required" });

    try {
      const { data, error } = await supabase
        .from('recipes')
        .insert([{
          name,
          description: description || "",
          ingredients: JSON.stringify(ingredients || []),
          steps: JSON.stringify(steps || []),
          difficulty: difficulty || "Fácil",
          prep_time: prep_time || "5 min",
          equipment: JSON.stringify(equipment || []),
          image_url: image_url || `https://picsum.photos/seed/${Math.random()}/800/600`,
          category: category || "Tradicional",
          is_brazilian: is_brazilian ? 1 : 0,
          country: country || "",
          history: history || ""
        }])
        .select();

      if (error) throw error;
      res.json({ success: true, id: data[0].id });
    } catch (err) {
      console.error("Failed to create recipe:", err);
      res.status(500).json({ error: "Failed to create recipe" });
    }
  });

  // Update Recipe
  app.put("/api/recipes/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, ingredients, steps, difficulty, prep_time, equipment, category, is_brazilian, country, history } = req.body;
    
    if (!name) return res.status(400).json({ error: "Name is required" });

    try {
      const { error } = await supabase
        .from('recipes')
        .update({
          name,
          description: description || "",
          ingredients: JSON.stringify(ingredients || []),
          steps: JSON.stringify(steps || []),
          difficulty: difficulty || "Fácil",
          prep_time: prep_time || "5 min",
          equipment: JSON.stringify(equipment || []),
          category: category || "Tradicional",
          is_brazilian: is_brazilian ? 1 : 0,
          country: country || "",
          history: history || ""
        })
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to update recipe:", err);
      res.status(500).json({ error: "Failed to update recipe" });
    }
  });

  // Delete Recipe
  app.delete("/api/recipes/:id", async (req, res) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', req.params.id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete recipe:", err);
      res.status(500).json({ error: "Failed to delete recipe" });
    }
  });

  // Delete All Recipes (Dev only)
  app.delete("/api/dev/clear-db", async (req, res) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .neq('id', 0); // Hack to delete all since Supabase requires a filter

      if (error) throw error;
      res.json({ success: true, message: "Database cleared" });
    } catch (err) {
      console.error("Failed to clear database:", err);
      res.status(500).json({ error: "Failed to clear database" });
    }
  });

  // Dev Mode: Override Image
  app.post("/api/dev/override-image", async (req, res) => {
    const { recipeId, imageUrl } = req.body;
    if (!recipeId || !imageUrl) return res.status(400).json({ error: "Missing fields" });

    try {
      const { error } = await supabase
        .from('recipes')
        .update({ image_url: imageUrl })
        .eq('id', recipeId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to override image:", err);
      res.status(500).json({ error: "Failed to override image" });
    }
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
