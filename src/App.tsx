import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Coffee, 
  Cloud, 
  Sun, 
  Droplets,
  ChevronRight, 
  Clock, 
  BarChart, 
  Settings, 
  X,
  Upload,
  Plus,
  Database,
  MapPin,
  Sparkles,
  Globe,
  ScrollText,
  Edit,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { Recipe, WeatherData } from './types';

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isDev, setIsDev] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiSuggestion, setAiSuggestion] = useState<Recipe | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // New Recipe Form State
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    description: '',
    ingredients: '',
    steps: '',
    difficulty: 'Fácil',
    prep_time: '',
    equipment: '',
    category: 'Tradicional',
    is_brazilian: false,
    country: '',
    history: ''
  });

  // Categories
  const categories = useMemo(() => ['Todos', 'Tradicional', 'Mundial', 'Gelado', 'Especial'], []);

  const fetchRecipes = useCallback(async () => {
    console.log("fetchRecipes: Starting...");
    try {
      // Quick health check
      const ping = await fetch('/api/ping').catch(() => null);
      if (ping) console.log("API Ping status:", ping.status);
      else console.warn("API Ping failed completely");

      const res = await fetch('/api/recipes');
      console.log("fetchRecipes: Response received", res.status);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log("fetchRecipes: Data parsed", data.length, "recipes");
      setRecipes(data);
    } catch (err) {
      console.error("fetchRecipes: Failed", err);
    } finally {
      console.log("fetchRecipes: Setting loading to false");
      setLoading(false);
    }
  }, []);

  const getAiSuggestion = useCallback(async (w: WeatherData, currentRecipes: Recipe[]) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'undefined' || currentRecipes.length === 0) return;
    
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Com base no clima de ${w.city} (${w.temp}°C, ${w.condition}), sugira um tipo de café ideal entre estas opções: ${currentRecipes.map(r => r.name).join(', ')}. 
        Retorne apenas o nome exato da receita.`
      });
      
      const suggestionName = response.text?.trim();
      if (suggestionName) {
        const match = currentRecipes.find(r => r.name.toLowerCase() === suggestionName.toLowerCase() || 
                                       r.name.toLowerCase().includes(suggestionName.toLowerCase()));
        if (match) setAiSuggestion(match);
      }
    } catch (err) {
      // Silent fail
    }
  }, []);

  const fetchWeather = useCallback(() => {
    console.log("fetchWeather: Starting...");
    if ("geolocation" in navigator) {
      console.log("fetchWeather: Geolocation supported, requesting position...");
      navigator.geolocation.getCurrentPosition(async (position) => {
        console.log("fetchWeather: Position received");
        const { latitude, longitude } = position.coords;
        try {
          console.log("fetchWeather: Fetching weather data...");
          // Fetch Weather Data (Open-Meteo)
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          const weatherData = await weatherRes.json();
          
          console.log("fetchWeather: Fetching city name...");
          // Fetch City Name (Nominatim) - Using a more specific User-Agent and fallback
          let city = 'Sua Localização';
          try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
              headers: {
                'User-Agent': 'CheirinhoMineiroApp_v1_Production'
              }
            });
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              city = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.display_name?.split(',')[0] || 'Sua Localização';
            }
          } catch (e) {
            console.warn("fetchWeather: Nominatim failed, using fallback city name", e);
          }
          
          const temp = Math.round(weatherData.current_weather.temperature);
          const code = weatherData.current_weather.weathercode;
          
          // Map WMO codes to friendly strings
          let condition = 'Nublado';
          if (code === 0) condition = 'Ensolarado';
          else if (code <= 3) condition = 'Parcialmente Nublado';
          else if (code >= 51 && code <= 67) condition = 'Chuvoso';
          else if (code >= 80 && code <= 82) condition = 'Pancadas de Chuva';
          else if (code >= 95) condition = 'Tempestade';

          console.log("fetchWeather: Weather loaded", { temp, condition, city });
          setWeather({ temp, condition, city });
        } catch (err) {
          console.error("fetchWeather: API failed", err);
          setWeather({ temp: 22, condition: 'Nublado', city: 'Brasil' });
        }
      }, (err) => {
        console.warn("fetchWeather: Geolocation failed or denied", err);
        setWeather({ temp: 20, condition: 'Nublado', city: 'Brasil' });
      }, { timeout: 5000 });
    } else {
      console.warn("fetchWeather: Geolocation not supported");
      setWeather({ temp: 20, condition: 'Nublado', city: 'Brasil' });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Only enable dev mode if explicitly requested via URL
    if (params.get('admin') === 'true' || params.get('dev') === 'true') {
      setIsDev(true);
    }

    console.log("App mounted: Triggering initial fetches");
    fetchRecipes();
    fetchWeather();

    // Safety timeout: if still loading after 5 seconds, force stop
    const timer = setTimeout(() => {
      setLoading(current => {
        if (current) {
          console.warn("Safety timeout: Force stopping loading state");
          return false;
        }
        return current;
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [fetchRecipes, fetchWeather]);

  useEffect(() => {
    if (weather && recipes.length > 0 && !aiSuggestion) {
      getAiSuggestion(weather, recipes);
    }
  }, [weather, recipes, aiSuggestion, getAiSuggestion]);

  const filteredRecipes = useMemo(() => {
    const filtered = recipes.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || 
                            r.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || r.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
    console.log("Filtered recipes count:", filtered.length, "out of", recipes.length);
    return filtered;
  }, [recipes, search, selectedCategory]);

  const handleImageUpload = useCallback(async (recipeId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        await fetch('/api/dev/override-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipeId, imageUrl: base64 })
        });
        fetchRecipes();
      } catch (err) {
        alert("Erro ao salvar imagem");
      }
    };
    reader.readAsDataURL(file);
  }, [fetchRecipes]);

  const handleEditClick = useCallback((recipe: Recipe) => {
    setEditingId(recipe.id);
    setNewRecipe({
      name: recipe.name,
      description: recipe.description,
      ingredients: recipe.ingredients.join('\n'),
      steps: recipe.steps.join('\n'),
      difficulty: recipe.difficulty,
      prep_time: recipe.prep_time,
      equipment: recipe.equipment.join(', '),
      category: recipe.category,
      is_brazilian: recipe.is_brazilian,
      country: recipe.country || '',
      history: recipe.history || ''
    });
  }, []);

  const handleDeleteRecipe = useCallback(async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
    try {
      const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRecipes();
      }
    } catch (err) {
      alert("Erro ao excluir receita");
    }
  }, [fetchRecipes]);

  const handleClearDatabase = useCallback(async () => {
    if (!confirm("ATENÇÃO: Isso irá apagar TODAS as receitas do banco de dados. Deseja continuar?")) return;
    try {
      const res = await fetch('/api/dev/clear-db', { method: 'DELETE' });
      if (res.ok) {
        fetchRecipes();
        alert("Banco de dados limpo com sucesso!");
      }
    } catch (err) {
      alert("Erro ao limpar banco de dados");
    }
  }, [fetchRecipes]);

  const handleImportDataset = useCallback(async () => {
    if (!confirm("Deseja importar as receitas do arquivo JSON?")) return;
    try {
      const res = await fetch('/api/dev/import-dataset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        fetchRecipes();
        alert(`Sucesso! ${data.count} receitas importadas.`);
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (err) {
      alert("Erro ao importar dataset");
    }
  }, [fetchRecipes]);

  const handleAddRecipe = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...newRecipe,
      ingredients: newRecipe.ingredients.split('\n').filter(i => i.trim()),
      steps: newRecipe.steps.split('\n').filter(s => s.trim()),
      equipment: newRecipe.equipment.split(',').map(eq => eq.trim()).filter(eq => eq)
    };

    try {
      const url = editingId ? `/api/recipes/${editingId}` : '/api/recipes';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert(editingId ? "Receita atualizada com sucesso!" : "Receita adicionada com sucesso!");
        setEditingId(null);
        setNewRecipe({
          name: '',
          description: '',
          ingredients: '',
          steps: '',
          difficulty: 'Fácil',
          prep_time: '',
          equipment: '',
          category: 'Tradicional',
          is_brazilian: false,
          country: '',
          history: ''
        });
        fetchRecipes();
      }
    } catch (err) {
      alert("Erro ao salvar receita");
    }
  }, [newRecipe, fetchRecipes, editingId]);

  return (
    <div className="min-h-screen pb-20">
      {/* Dev Toggle Button - Hidden unless in dev mode */}
      {isDev && (
        <button 
          onClick={() => setShowDevPanel(true)}
          aria-label="Abrir Painel do Desenvolvedor"
          className="fixed top-6 right-6 z-[60] p-2 bg-coffee-900/5 hover:bg-coffee-900 text-coffee-900/10 hover:text-white rounded-xl shadow-none hover:shadow-xl transition-all flex items-center gap-2"
        >
          <Settings size={20} />
          <span className="hidden md:inline font-bold text-xs uppercase tracking-widest">Painel Admin</span>
        </button>
      )}

      {/* Hero Header */}
      <header className="relative min-h-[750px] flex flex-col items-center justify-start text-center px-6 overflow-hidden pt-32 pb-48">
        {/* Background Image with Blur and Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://picsum.photos/seed/coffee-hero/1920/1080?blur=2" 
            alt="Coffee Hero" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          {/* Multi-layered overlay for better text contrast */}
          <div className="absolute inset-0 bg-coffee-950/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-coffee-50/20 to-coffee-50" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-coffee-100 text-[10px] md:text-xs font-bold uppercase tracking-[0.5em] mb-8 drop-shadow-lg"
          >
            A Arte do Café
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-5xl md:text-8xl lg:text-9xl font-serif text-white mb-8 leading-[0.9] tracking-tight drop-shadow-2xl"
          >
            Cheirinho <br className="hidden md:block" /> Mineiro
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-white font-serif italic text-lg md:text-xl max-w-2xl mb-12 leading-relaxed opacity-90 drop-shadow-md"
          >
            Mais de 300 receitas de café, reunindo sabores tradicionais e especiais do mundo inteiro. 
            Descubra novas bebidas com base nos ingredientes e equipamentos que você já tem em casa.
          </motion.p>

          {/* Search & Filters Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col md:flex-row gap-4 w-full max-w-2xl px-4"
          >
            <div className="relative flex-1 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-coffee-400 group-focus-within:text-coffee-600 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Busque por nome, ingrediente ou país..."
                className="w-full pl-14 pr-6 py-5 bg-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200 transition-all text-coffee-900 placeholder:text-coffee-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </motion.div>
        </div>
      </header>

      {/* Weather Suggestion (Positioned with more care) */}
      <div className="px-6 max-w-5xl mx-auto -mt-24 relative z-20">
        {weather && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="p-6 md:p-10 rounded-[48px] bg-coffee-900 text-coffee-50 relative overflow-hidden group cursor-pointer shadow-[0_32px_64px_-12px_rgba(49,31,27,0.3)]"
            onClick={() => aiSuggestion && setSelectedRecipe(aiSuggestion)}
          >
            <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform duration-1000">
              <Coffee size={240} />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="p-5 bg-white/10 rounded-[32px] backdrop-blur-xl border border-white/10 shadow-inner">
                  {weather.temp > 25 ? <Sun className="text-yellow-400" size={28} /> : <Cloud className="text-blue-200" size={28} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-coffee-400 text-xs font-bold uppercase tracking-[0.2em] mb-1">
                    <MapPin size={14} /> {weather.city} • {weather.temp}°C
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif">Sugestão para o clima {weather.condition}</h2>
                </div>
              </div>

              {aiSuggestion && (
                <div className="flex items-center gap-5 bg-white/5 p-3 pr-6 rounded-[32px] backdrop-blur-md border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
                    <img 
                      src={aiSuggestion.display_image} 
                      alt={aiSuggestion.name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-coffee-400 uppercase font-black tracking-widest flex items-center gap-1 mb-0.5">
                      <Sparkles size={10} /> IA Especialista
                    </div>
                    <div className="font-serif text-xl text-white">{aiSuggestion.name}</div>
                  </div>
                  <ChevronRight className="text-coffee-500 ml-2" size={20} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="px-6 pt-16 pb-8 max-w-7xl mx-auto flex justify-center">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`pill-button whitespace-nowrap ${
                selectedCategory === cat 
                ? 'bg-coffee-900 text-white' 
                : 'bg-white text-coffee-600 hover:bg-coffee-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe Grid */}
      <main className="px-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-coffee-200 border-t-coffee-900 rounded-full animate-spin"></div>
            <p className="font-serif italic text-coffee-600">Moendo os grãos...</p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <button 
                onClick={() => {
                  setIsDev(true);
                  setShowDevPanel(true);
                  setLoading(false);
                }}
                className="px-6 py-2 bg-coffee-100 text-coffee-600 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-coffee-900 hover:text-white transition-all"
              >
                Entrar em Modo Desenvolvedor
              </button>
              {isDev && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-mono text-red-600 max-w-md">
                  <p className="font-bold mb-2">Debug Info (Admin Only):</p>
                  <p>Recipes: {recipes.length}</p>
                  <p>Weather: {weather ? 'Loaded' : 'Loading...'}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredRecipes.map((recipe, idx) => (
              <motion.div
                key={recipe.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="recipe-card group cursor-pointer"
                onClick={() => setSelectedRecipe(recipe)}
              >
                <div className="aspect-[4/3] overflow-hidden relative">
                  <img 
                    src={recipe.display_image} 
                    alt={recipe.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  {recipe.is_brazilian && (
                    <div className="absolute top-4 left-4 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">
                      Alma Brasileira
                    </div>
                  )}
                  {isDev && (
                    <label 
                      className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur rounded-2xl cursor-pointer hover:bg-white transition-colors shadow-lg" 
                      onClick={e => e.stopPropagation()}
                      title="Alterar imagem da receita"
                    >
                      <Upload size={18} className="text-coffee-900" />
                      <input type="file" className="hidden" aria-label="Upload de imagem" accept="image/*" onChange={(e) => handleImageUpload(recipe.id, e)} />
                    </label>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-serif font-medium text-coffee-900">{recipe.name}</h3>
                    <span className="text-xs font-bold text-coffee-400 uppercase tracking-widest">{recipe.difficulty}</span>
                  </div>
                  <p className="text-coffee-600 text-sm line-clamp-2 mb-4 font-serif italic">{recipe.description}</p>
                  <div className="flex items-center gap-4 text-coffee-400 text-xs font-medium">
                    <div className="flex items-center gap-1">
                      <Clock size={14} /> {recipe.prep_time}
                    </div>
                    <div className="flex items-center gap-1">
                      <Coffee size={14} /> {recipe.category}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && filteredRecipes.length === 0 && (
          <div className="text-center py-20">
            <Coffee size={48} className="mx-auto text-coffee-200 mb-4" />
            <h3 className="text-2xl font-serif text-coffee-900 mb-2">Nenhuma receita encontrada</h3>
            <p className="text-coffee-600 italic mb-2">Total de receitas carregadas: {recipes.length}</p>
            <p className="text-coffee-600 italic mb-6">Tente buscar por outros termos ou categorias.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <button 
                onClick={async () => {
                  setSearch(''); 
                  setSelectedCategory('Todos'); 
                  if (recipes.length === 0) {
                    const seedRes = await fetch('/api/dev/seed', { method: 'POST' });
                    const seedData = await seedRes.json();
                    alert(`Seed result: ${JSON.stringify(seedData)}`);
                  }
                  fetchRecipes();
                }}
                className="px-8 py-3 bg-coffee-900 text-white rounded-full font-bold uppercase tracking-widest hover:bg-coffee-950 transition-colors"
              >
                Ver Todas as Receitas
              </button>
              <button 
                onClick={async () => {
                  if (confirm("Isso irá resetar o banco de dados. Continuar?")) {
                    setLoading(true);
                    const res = await fetch('/api/dev/seed?force=true', { method: 'POST' });
                    const data = await res.json();
                    alert(`Reset result: ${JSON.stringify(data)}`);
                    fetchRecipes();
                  }
                }}
                className="px-8 py-3 bg-white border-2 border-coffee-900 text-coffee-900 rounded-full font-bold uppercase tracking-widest hover:bg-coffee-50 transition-colors"
              >
                Forçar Reset do Banco
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer with Dev Access */}
      <footer className="mt-20 py-12 border-t border-coffee-100 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-coffee-900 rounded-xl flex items-center justify-center text-white">
              <Coffee size={20} />
            </div>
            <span className="font-serif text-xl text-coffee-900 font-bold">Cheirinho Mineiro</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-coffee-400 font-medium">
            <button 
              onClick={() => {
                setIsDev(true);
                setShowDevPanel(true);
              }}
              className="hover:text-coffee-900 transition-colors flex items-center gap-2"
            >
              <Settings size={14} /> Modo Desenvolvedor
            </button>
            <span>© 2024 • Feito com Alma Brasileira</span>
          </div>
        </div>
      </footer>

      {/* Recipe Modal */}
      <AnimatePresence>
        {selectedRecipe && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-coffee-950/40 backdrop-blur-sm"
            onClick={() => setSelectedRecipe(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-coffee-50 w-full max-w-4xl max-h-[90vh] rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row"
              onClick={e => e.stopPropagation()}
            >
              <div className="md:w-1/2 h-64 md:h-auto relative">
                <img 
                  src={selectedRecipe.display_image} 
                  alt={selectedRecipe.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setSelectedRecipe(null)}
                  aria-label="Fechar modal"
                  className="absolute top-6 left-6 p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white/40 transition-colors md:hidden"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="md:w-1/2 p-8 md:p-12 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-xs font-bold text-coffee-500 uppercase tracking-[0.2em] mb-2">{selectedRecipe.category}</div>
                    <h2 className="text-4xl md:text-5xl font-serif text-coffee-900">{selectedRecipe.name}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDev && (
                      <div className="flex items-center gap-2 mr-2">
                        <button 
                          onClick={() => {
                            handleEditClick(selectedRecipe);
                            setShowDevPanel(true);
                            setSelectedRecipe(null);
                          }}
                          className="p-3 bg-coffee-100 rounded-2xl text-coffee-600 hover:bg-coffee-900 hover:text-white transition-colors"
                          title="Editar"
                        >
                          <Edit size={20} />
                        </button>
                        <button 
                          onClick={() => {
                            handleDeleteRecipe(selectedRecipe.id);
                            setSelectedRecipe(null);
                          }}
                          className="p-3 bg-red-50 rounded-2xl text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={() => setSelectedRecipe(null)}
                      aria-label="Fechar modal"
                      className="p-3 bg-coffee-100 rounded-2xl text-coffee-900 hover:bg-coffee-200 transition-colors hidden md:block"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <p className="text-coffee-700 italic font-serif text-lg mb-4 leading-relaxed">
                  {selectedRecipe.description}
                </p>

                {selectedRecipe.country && (
                  <div className="flex items-center gap-2 text-coffee-500 text-sm mb-6">
                    <Globe size={16} />
                    <span className="font-medium">{selectedRecipe.country}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6 mb-10">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-coffee-100 rounded-2xl text-coffee-700">
                      <Clock size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-coffee-400 tracking-widest">Tempo</div>
                      <div className="font-medium text-coffee-900">{selectedRecipe.prep_time}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-coffee-100 rounded-2xl text-coffee-700">
                      <BarChart size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-coffee-400 tracking-widest">Dificuldade</div>
                      <div className="font-medium text-coffee-900">{selectedRecipe.difficulty}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-10">
                  <section>
                    <h4 className="text-xl font-serif text-coffee-900 mb-4 flex items-center gap-2">
                      <Droplets size={20} className="text-coffee-400" /> Ingredientes
                    </h4>
                    <ul className="space-y-3">
                      {selectedRecipe.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-center gap-3 text-coffee-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-coffee-300" />
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h4 className="text-xl font-serif text-coffee-900 mb-4 flex items-center gap-2">
                      <Coffee size={20} className="text-coffee-400" /> Utensílios
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedRecipe.equipment.map((eq, i) => (
                        <span key={i} className="px-4 py-1.5 bg-coffee-100 rounded-full text-sm text-coffee-700 font-medium">
                          {eq}
                        </span>
                      ))}
                    </div>
                  </section>

                  {selectedRecipe.history && (
                    <section className="p-8 bg-coffee-100/50 rounded-[32px] border border-coffee-100">
                      <h4 className="text-xl font-serif text-coffee-900 mb-4 flex items-center gap-2">
                        <ScrollText size={20} className="text-coffee-400" /> História & Curiosidades
                      </h4>
                      <p className="text-coffee-700 leading-relaxed italic font-serif">
                        {selectedRecipe.history}
                      </p>
                    </section>
                  )}

                  <section>
                    <h4 className="text-xl font-serif text-coffee-900 mb-4 flex items-center gap-2">
                      <ChevronRight size={20} className="text-coffee-400" /> Modo de Preparo
                    </h4>
                    <div className="space-y-6">
                      {selectedRecipe.steps.map((step, i) => (
                        <div key={i} className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-coffee-900 text-white flex items-center justify-center text-sm font-bold">
                            {i + 1}
                          </div>
                          <p className="text-coffee-700 leading-relaxed pt-1">{step}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Developer Panel Modal */}
      <AnimatePresence>
        {showDevPanel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-coffee-950/80 backdrop-blur-md"
            onClick={() => setShowDevPanel(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[48px] overflow-hidden shadow-2xl flex flex-col md:flex-row"
              onClick={e => e.stopPropagation()}
            >
              {/* Sidebar / List */}
              <div className="md:w-1/3 bg-coffee-50 border-r border-coffee-100 flex flex-col">
                <div className="p-8 border-b border-coffee-100 flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-serif text-coffee-900 flex items-center gap-3">
                      <Database className="text-coffee-500" /> Painel Dev
                    </h2>
                    <p className="text-coffee-500 text-sm mt-2">Gerencie receitas e imagens do sistema.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingId(null);
                        setNewRecipe({
                          name: '',
                          description: '',
                          ingredients: '',
                          steps: '',
                          difficulty: 'Fácil',
                          prep_time: '',
                          equipment: '',
                          category: 'Tradicional',
                          is_brazilian: false,
                          country: '',
                          history: ''
                        });
                      }}
                      className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                    >
                      <Plus size={14} /> Nova
                    </button>
                    <button 
                      onClick={handleImportDataset}
                      className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                      title="Importar de /data/cafes_100_receitas.json"
                    >
                      <Database size={14} /> Importar
                    </button>
                    <button 
                      onClick={handleClearDatabase}
                      className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                    >
                      <Trash2 size={14} /> Limpar
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                  <div className="text-[10px] font-bold text-coffee-400 uppercase tracking-widest px-4 mb-2">Todas as Receitas</div>
                  {recipes.map(r => (
                    <div key={r.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white transition-colors group">
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                        <img 
                          src={r.display_image} 
                          alt={r.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-coffee-900 truncate">{r.name}</div>
                        <div className="text-[10px] text-coffee-400 uppercase">{r.category}</div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditClick(r)}
                          aria-label={`Editar ${r.name}`}
                          className="p-2 bg-coffee-100 text-coffee-600 rounded-xl hover:bg-coffee-900 hover:text-white transition-colors"
                        >
                          <Edit size={14} />
                        </button>
                        <label 
                          className="p-2 bg-coffee-100 text-coffee-600 rounded-xl cursor-pointer hover:bg-coffee-900 hover:text-white transition-colors"
                          title="Upload de imagem"
                        >
                          <Upload size={14} />
                          <input type="file" className="hidden" aria-label="Upload de imagem" accept="image/*" onChange={(e) => handleImageUpload(r.id, e)} />
                        </label>
                        <button 
                          onClick={() => handleDeleteRecipe(r.id)}
                          aria-label={`Excluir ${r.name}`}
                          className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Area */}
              <div className="md:w-2/3 p-8 md:p-12 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-serif text-coffee-900 flex items-center gap-3">
                    {editingId ? <Edit className="text-coffee-500" /> : <Plus className="text-coffee-500" />}
                    {editingId ? 'Editar Receita' : 'Adicionar Nova Receita'}
                  </h3>
                  <div className="flex items-center gap-4">
                    {editingId && (
                      <button 
                        onClick={() => {
                          setEditingId(null);
                          setNewRecipe({
                            name: '',
                            description: '',
                            ingredients: '',
                            steps: '',
                            difficulty: 'Fácil',
                            prep_time: '',
                            equipment: '',
                            category: 'Tradicional',
                            is_brazilian: false,
                            country: '',
                            history: ''
                          });
                        }}
                        className="px-6 py-3 bg-coffee-100 text-coffee-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-coffee-200 transition-colors"
                      >
                        Cancelar Edição
                      </button>
                    )}
                    <button 
                      onClick={() => setShowDevPanel(false)}
                      aria-label="Fechar painel"
                      className="p-3 bg-coffee-100 rounded-2xl text-coffee-900 hover:bg-coffee-200 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddRecipe} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-coffee-400 uppercase tracking-widest">Nome da Receita</label>
                      <input 
                        required
                        type="text" 
                        className="w-full p-4 bg-coffee-50 rounded-2xl border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200"
                        value={newRecipe.name}
                        onChange={e => setNewRecipe({...newRecipe, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-coffee-400 uppercase tracking-widest">Categoria</label>
                      <select 
                        className="w-full p-4 bg-coffee-50 rounded-2xl border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200"
                        value={newRecipe.category}
                        onChange={e => setNewRecipe({...newRecipe, category: e.target.value})}
                      >
                        {categories.filter(c => c !== 'Todos').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-coffee-400 uppercase tracking-widest">Descrição Breve</label>
                    <textarea 
                      className="w-full p-4 bg-coffee-50 rounded-2xl border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200 h-24"
                      value={newRecipe.description}
                      onChange={e => setNewRecipe({...newRecipe, description: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-coffee-400 uppercase tracking-widest">País de Origem</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Brasil, Etiópia..."
                        className="w-full p-4 bg-coffee-50 rounded-2xl border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200"
                        value={newRecipe.country}
                        onChange={e => setNewRecipe({...newRecipe, country: e.target.value})}
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-8">
                      <input 
                        type="checkbox" 
                        id="is_brazilian"
                        className="w-5 h-5 accent-coffee-900"
                        checked={newRecipe.is_brazilian}
                        onChange={e => setNewRecipe({...newRecipe, is_brazilian: e.target.checked})}
                      />
                      <label htmlFor="is_brazilian" className="text-sm font-bold text-coffee-900 uppercase tracking-widest cursor-pointer">Alma Brasileira</label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-coffee-400 uppercase tracking-widest">História / Curiosidade</label>
                    <textarea 
                      className="w-full p-4 bg-coffee-50 rounded-2xl border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200 h-32"
                      placeholder="Conte um pouco sobre a origem ou uma curiosidade desta receita..."
                      value={newRecipe.history}
                      onChange={e => setNewRecipe({...newRecipe, history: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-coffee-400 uppercase tracking-widest">Tempo Prep</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 10 min"
                        className="w-full p-4 bg-coffee-50 rounded-2xl border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200"
                        value={newRecipe.prep_time}
                        onChange={e => setNewRecipe({...newRecipe, prep_time: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-coffee-400 uppercase tracking-widest">Dificuldade</label>
                      <select 
                        className="w-full p-4 bg-coffee-50 rounded-2xl border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200"
                        value={newRecipe.difficulty}
                        onChange={e => setNewRecipe({...newRecipe, difficulty: e.target.value})}
                      >
                        <option value="Fácil">Fácil</option>
                        <option value="Média">Média</option>
                        <option value="Difícil">Difícil</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-coffee-400 uppercase tracking-widest">Ingredientes (um por linha)</label>
                      <textarea 
                        className="w-full p-4 bg-coffee-50 rounded-2xl border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200 h-32"
                        value={newRecipe.ingredients}
                        onChange={e => setNewRecipe({...newRecipe, ingredients: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-coffee-400 uppercase tracking-widest">Passos (um por linha)</label>
                      <textarea 
                        className="w-full p-4 bg-coffee-50 rounded-2xl border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200 h-32"
                        value={newRecipe.steps}
                        onChange={e => setNewRecipe({...newRecipe, steps: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-coffee-400 uppercase tracking-widest">Utensílios (separados por vírgula)</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-coffee-50 rounded-2xl border border-coffee-100 focus:outline-none focus:ring-2 focus:ring-coffee-200"
                      value={newRecipe.equipment}
                      onChange={e => setNewRecipe({...newRecipe, equipment: e.target.value})}
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-5 bg-coffee-900 text-white rounded-3xl font-bold uppercase tracking-widest hover:bg-coffee-950 transition-colors shadow-xl"
                  >
                    {editingId ? 'Atualizar Receita' : 'Salvar Receita'}
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
