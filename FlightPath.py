import requests
from datetime import datetime, timedelta
import pytz
import sys

NTFY_TOPIC = "planes-overhead"
NTFY_SERVER = "http://"  # self-hosted server URL
USE_NOTIFY = False
TIMEZONE = pytz.timezone("Europe/London")

RUNWAY_ALTERNATION = {
    "2025-08-04": "27L",
    "2025-08-11": "27R",
    "2025-08-18": "27L",
    "2025-08-25": "27R",
    "2025-09-01": "27L",
    "2025-09-08": "27R",
}

NIGHT_ALTERNATION = {
    "2025-08-04": {"primary": "27L", "secondary": "09R"},
    "2025-08-11": {"primary": "09L", "secondary": "27R"},
    "2025-08-18": {"primary": "27R", "secondary": "09L"},
    "2025-08-25": {"primary": "09R", "secondary": "27L"},
    "2025-09-01": {"primary": "27L", "secondary": "09R"},
}

OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=51.47&longitude=-0.4543"
    "&hourly=wind_speed_10m,wind_direction_10m"
    "&timezone=Europe/London"
    "&forecast_days=3&wind_speed_unit=kn"
)

def get_forecast():
    headers = {"User-Agent": "plane-forecast-script/1.0"}
    r = requests.get(OPEN_METEO_URL, headers=headers)
    r.raise_for_status()
    return r.json()

def find_wind_for_time(forecast, date, hour):
    target_time = datetime.combine(date, datetime.min.time()).replace(hour=hour, tzinfo=TIMEZONE)
    target_str = target_time.strftime("%Y-%m-%dT%H:%M")
    times = forecast["hourly"]["time"]
    speeds = forecast["hourly"]["wind_speed_10m"]
    dirs = forecast["hourly"]["wind_direction_10m"]
    for t, s, d in zip(times, speeds, dirs):
        if t.startswith(target_str):
            return s, d
    return None, None

def is_westerly(wind_speed_knots, wind_deg):
    if wind_speed_knots < 5:
        return True
    return 200 <= wind_deg <= 360

def get_week_start(date):
    return (date - timedelta(days=date.weekday())).strftime("%Y-%m-%d")

def get_runway_for_week(date):
    return RUNWAY_ALTERNATION.get(get_week_start(date), "27L")

def get_night_runway(date, westerly):
    week = NIGHT_ALTERNATION.get(get_week_start(date), {"primary": "27L", "secondary": "09R"})
    return week["primary"] if westerly else week["secondary"]

def send_notification(message):
    if USE_NOTIFY and NTFY_TOPIC:
        url = f"{NTFY_SERVER.rstrip('/')}/{NTFY_TOPIC}"
        try:
            requests.post(url, data=message.encode("utf-8"))
        except Exception as e:
            print(f"Failed to send ntfy notification: {e}")
            print(message)
    else:
        print(message)

def main():
    try:
        now = datetime.now(TIMEZONE)
        if now.hour < 6:
            target_date = now.date()
        else:
            target_date = (now + timedelta(days=1)).date()
        forecast = get_forecast()
        wind_speed, wind_dir = find_wind_for_time(forecast, target_date, 6)

        if wind_speed is None:
            send_notification("❓ Could not retrieve 6 AM wind forecast.")
            return

        westerly = is_westerly(wind_speed, wind_dir)

        if now.hour >= 22 or now.hour < 6:
            runway = get_night_runway(target_date, westerly)
        else:
            runway = get_runway_for_week(target_date)

        if not westerly:
            msg = "😴 No planes overhead — easterly ops expected."
        else:
            if runway in ["27L", "09R"]:
                msg = f"🔊 Planes likely overhead on southern runway ({runway}) — {wind_speed:.1f} kt from {wind_dir}°." \
                      + (" 🚨 Heavy arrivals on both runways between 06:00–07:00." if now.hour == 6 else "")
            else:
                msg = f"✅ Planes on northern runway ({runway}) — {wind_speed:.1f} kt from {wind_dir}°." \
                      + (" 🚨 Heavy arrivals on both runways between 06:00–07:00." if now.hour == 6 else "")

        send_notification(msg)

    except Exception as e:
        send_notification(f"⚠️ Error in plane forecast: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
