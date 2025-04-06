import { McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from 'axios';

// AccuWeather API Configuration
const API_KEY = 'JweIuAzg4ORLhYDQV54ofDnVC3rIm1V4';
const LOCATION_BASE_URL = 'http://dataservice.accuweather.com/locations/v1/cities/search';
const CURRENT_CONDITIONS_BASE_URL = 'http://dataservice.accuweather.com/currentconditions/v1/';
const FORECAST_BASE_URL = 'http://dataservice.accuweather.com/forecasts/v1/daily/5day/';

const mcpServer = new McpServer({
    name: "Weather Service",
    version: "1.0.0"
});

async function getWeatherByCity(city: string) {
    try {
        // Step 1: Get the location key for the city
        const locationResponse = await axios.get(`${LOCATION_BASE_URL}?apikey=${API_KEY}&q=${city}`);
        
        if (!locationResponse.data || locationResponse.data.length === 0) {
            return { error: 'Location not found' };
        }
        
        const locationKey = locationResponse.data[0].Key;
        const locationName = locationResponse.data[0].LocalizedName;
        const countryName = locationResponse.data[0].Country.LocalizedName;
        
        // Step 2: Get current conditions
        const currentConditionsResponse = await axios.get(`${CURRENT_CONDITIONS_BASE_URL}${locationKey}?apikey=${API_KEY}`);
        
        if (!currentConditionsResponse.data || currentConditionsResponse.data.length === 0) {
            return { error: 'Weather data not found' };
        }
        
        const currentConditions = currentConditionsResponse.data[0];
        
        // Step 3: Get 5-day forecast
        const forecastResponse = await axios.get(`${FORECAST_BASE_URL}${locationKey}?apikey=${API_KEY}`);
        
        // Step 4: Format weather data
        const weatherData = {
            location: {
                name: locationName,
                country: countryName,
                key: locationKey
            },
            current: {
                temperature: {
                    metric: currentConditions.Temperature.Metric.Value,
                    imperial: currentConditions.Temperature.Imperial.Value
                },
                weatherText: currentConditions.WeatherText,
                weatherIcon: currentConditions.WeatherIcon,
                hasRain: currentConditions.HasPrecipitation,
                precipitationType: currentConditions.PrecipitationType,
                isDayTime: currentConditions.IsDayTime,
                observationTime: currentConditions.LocalObservationDateTime
            },
            forecast: forecastResponse.data.DailyForecasts.map((day: any) => ({
                date: day.Date,
                temperature: {
                    min: {
                        metric: ((day.Temperature.Minimum.Value - 32) * 5/9).toFixed(1),
                        imperial: day.Temperature.Minimum.Value
                    },
                    max: {
                        metric: ((day.Temperature.Maximum.Value - 32) * 5/9).toFixed(1),
                        imperial: day.Temperature.Maximum.Value
                    }
                },
                day: {
                    iconPhrase: day.Day.IconPhrase,
                    hasPrecipitation: day.Day.HasPrecipitation,
                    precipitationType: day.Day.PrecipitationType
                },
                night: {
                    iconPhrase: day.Night.IconPhrase,
                    hasPrecipitation: day.Night.HasPrecipitation,
                    precipitationType: day.Night.PrecipitationType
                }
            }))
        };
        
        return weatherData;
    } catch (error: any) {
        console.error('Error fetching weather data:', error.message);
        return { error: 'Failed to fetch weather data' };
    }
}

// Add the weather tool
mcpServer.tool("getWeatherbyCity", { city: z.string() }, async ({ city }) => ({
    content: [{ 
        type: "text", 
        text: JSON.stringify(await getWeatherByCity(city))
    }]
}));

async function init() {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
}

init();