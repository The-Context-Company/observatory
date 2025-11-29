"""Travel agent with trip planning tools."""

from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

# Mock data
DESTINATIONS = {
    "paris": {
        "name": "Paris",
        "country": "France",
        "description": "The City of Light, known for its art, fashion, and culture",
        "bestSeason": "Spring (April-June) and Fall (September-November)",
        "currency": "EUR",
        "language": "French",
    },
    "tokyo": {
        "name": "Tokyo",
        "country": "Japan",
        "description": "A vibrant metropolis blending tradition and cutting-edge technology",
        "bestSeason": "Spring (March-May) for cherry blossoms",
        "currency": "JPY",
        "language": "Japanese",
    },
    "bali": {
        "name": "Bali",
        "country": "Indonesia",
        "description": "Tropical paradise with beaches, temples, and rice terraces",
        "bestSeason": "Dry season (April-October)",
        "currency": "IDR",
        "language": "Indonesian",
    },
}

HOTELS = {
    "paris": [
        {
            "name": "Hotel Eiffel",
            "pricePerNight": 200,
            "rating": 4.5,
            "budget": "luxury",
        },
        {
            "name": "Paris Budget Inn",
            "pricePerNight": 80,
            "rating": 3.8,
            "budget": "budget",
        },
        {
            "name": "Le Marais Boutique",
            "pricePerNight": 150,
            "rating": 4.2,
            "budget": "mid-range",
        },
    ],
    "tokyo": [
        {"name": "Tokyo Grand", "pricePerNight": 250, "rating": 4.7, "budget": "luxury"},
        {
            "name": "Shibuya Hostel",
            "pricePerNight": 50,
            "rating": 4.0,
            "budget": "budget",
        },
        {
            "name": "Shinjuku Central",
            "pricePerNight": 120,
            "rating": 4.3,
            "budget": "mid-range",
        },
    ],
    "bali": [
        {"name": "Bali Resort", "pricePerNight": 180, "rating": 4.6, "budget": "luxury"},
        {
            "name": "Beach Bungalow",
            "pricePerNight": 60,
            "rating": 4.1,
            "budget": "budget",
        },
        {
            "name": "Ubud Villa",
            "pricePerNight": 100,
            "rating": 4.4,
            "budget": "mid-range",
        },
    ],
}

ATTRACTIONS = {
    "paris": [
        "Eiffel Tower",
        "Louvre Museum",
        "Notre-Dame Cathedral",
        "Champs-Élysées",
        "Arc de Triomphe",
    ],
    "tokyo": [
        "Senso-ji Temple",
        "Tokyo Skytree",
        "Meiji Shrine",
        "Shibuya Crossing",
        "Tsukiji Fish Market",
    ],
    "bali": [
        "Uluwatu Temple",
        "Tegallalang Rice Terraces",
        "Sacred Monkey Forest",
        "Tanah Lot",
        "Mount Batur",
    ],
}


@tool
def get_destination_info(destination: str) -> dict:
    """
    Get detailed information about a travel destination.

    Args:
        destination: Name of the destination (e.g., 'paris', 'tokyo', 'bali')

    Returns:
        Destination information including description, best season, and practical details
    """
    dest = DESTINATIONS.get(destination.lower())
    if dest:
        return {"success": True, "destination": dest}
    return {"success": False, "error": f"Destination {destination} not found"}


@tool
def get_weather_forecast(destination: str) -> dict:
    """
    Get the current weather forecast for a destination.

    Args:
        destination: Name of the destination

    Returns:
        Weather information including temperature and conditions
    """
    # Mock weather data
    weather_data = {
        "paris": {"temperature": "18°C", "condition": "Partly cloudy", "humidity": "65%"},
        "tokyo": {"temperature": "22°C", "condition": "Sunny", "humidity": "50%"},
        "bali": {"temperature": "28°C", "condition": "Warm and humid", "humidity": "80%"},
    }

    weather = weather_data.get(destination.lower())
    if weather:
        return {"success": True, "weather": weather, "destination": destination}
    return {"success": False, "error": f"Weather data for {destination} not available"}


@tool
def find_hotels(destination: str, budget: str = "mid-range") -> dict:
    """
    Find hotels in a destination based on budget.

    Args:
        destination: Name of the destination
        budget: Budget category (budget, mid-range, luxury)

    Returns:
        List of hotels matching the criteria
    """
    hotels = HOTELS.get(destination.lower(), [])
    if budget != "all":
        hotels = [h for h in hotels if h["budget"] == budget]

    if hotels:
        return {"success": True, "hotels": hotels, "destination": destination}
    return {
        "success": False,
        "error": f"No hotels found for {destination} with budget {budget}",
    }


@tool
def get_attractions(destination: str) -> dict:
    """
    Get popular attractions and activities at a destination.

    Args:
        destination: Name of the destination

    Returns:
        List of popular attractions and things to do
    """
    attractions = ATTRACTIONS.get(destination.lower())
    if attractions:
        return {"success": True, "attractions": attractions, "destination": destination}
    return {"success": False, "error": f"Attractions for {destination} not found"}


@tool
def calculate_trip_budget(days: int, hotel_price_per_night: int, daily_expenses: int = 100) -> dict:
    """
    Calculate the estimated budget for a trip.

    Args:
        days: Number of days for the trip
        hotel_price_per_night: Hotel price per night in local currency
        daily_expenses: Estimated daily expenses for food, transport, etc.

    Returns:
        Budget breakdown including accommodation, daily expenses, and total
    """
    accommodation_cost = days * hotel_price_per_night
    expenses_cost = days * daily_expenses
    total = accommodation_cost + expenses_cost

    return {
        "success": True,
        "budget": {
            "days": days,
            "accommodation": accommodation_cost,
            "dailyExpenses": expenses_cost,
            "total": total,
        },
    }


def create_travel_agent():
    """
    Create a travel agent with trip planning tools.

    Returns:
        Configured LangGraph agent ready to help plan trips
    """
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

    tools = [
        get_destination_info,
        get_weather_forecast,
        find_hotels,
        get_attractions,
        calculate_trip_budget,
    ]

    system_prompt = """You are a helpful travel planning agent. You assist users with planning their trips by providing destination information, weather forecasts, hotel recommendations, and budget estimates.

When a user asks about travel:
1. Use tools to gather relevant information
2. Provide enthusiastic and helpful responses
3. Suggest activities and attractions
4. Help calculate budgets"""

    agent = create_react_agent(llm, tools, prompt=system_prompt)

    return agent
