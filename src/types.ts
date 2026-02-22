export interface Recipe {
  id: number;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  difficulty: string;
  prep_time: string;
  equipment: string[];
  image_url: string;
  display_image: string;
  category: string;
  is_brazilian: boolean;
  country?: string;
  history?: string;
}

export interface WeatherData {
  temp: number;
  condition: string;
  city: string;
}
