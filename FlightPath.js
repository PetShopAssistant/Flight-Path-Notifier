// Heathrow planes predictor for n8n Code node

const NTFY_TOPIC = "planes-overhead";
const NTFY_SERVER = ""; // ntfy server url
const USE_NOTIFY = true;

const RUNWAY_ALTERNATION = {
	"2025-08-04": "27L",
	"2025-08-11": "27R",
	"2025-08-18": "27L",
	"2025-08-25": "27R",
	"2025-09-01": "27L",
	"2025-09-08": "27R",
};

const NIGHT_ALTERNATION = {
	"2025-08-04": { primary: "27L", secondary: "09R" },
	"2025-08-11": { primary: "09L", secondary: "27R" },
	"2025-08-18": { primary: "27R", secondary: "09L" },
	"2025-08-25": { primary: "09R", secondary: "27L" },
	"2025-09-01": { primary: "27L", secondary: "09R" },
};

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
	+ "?latitude=51.47&longitude=-0.4543"
	+ "&hourly=wind_speed_10m,wind_direction_10m"
	+ "&timezone=Europe/London"
	+ "&forecast_days=3&wind_speed_unit=kn";

function getWeekStart(date) {
	const day = new Date(date);
	const diff = day.getDate() - day.getDay() + (day.getDay() === 0 ? -6 : 1);
	const monday = new Date(day.setDate(diff));
	return monday.toISOString().split("T")[0];
}

function isWesterly(speed, dir) {
	if (speed < 5) return true;
	return dir >= 200 && dir <= 360;
}

function getRunwayForWeek(date) {
	return RUNWAY_ALTERNATION[getWeekStart(date)] || "27L";
}

function getNightRunway(date, westerly) {
	const week = NIGHT_ALTERNATION[getWeekStart(date)] || { primary: "27L", secondary: "09R" };
	return westerly ? week.primary : week.secondary;
}

async function sendNotification(message) {
	if (USE_NOTIFY && NTFY_TOPIC) {
		await this.helpers.httpRequest({
			method: "POST",
			url: `${NTFY_SERVER.replace(/\/$/, "")}/${NTFY_TOPIC}`,
			body: message,
		});
	} else {
		console.log(message);
	}
}

async function main() {
	try {
		const now = new Date();
		const londonOffset = now.getTimezoneOffset() / -60;
		now.setHours(now.getHours() + londonOffset);

		let targetDate;
		if (now.getHours() < 6) {
			targetDate = now;
		} else {
			targetDate = new Date(now);
			targetDate.setDate(now.getDate() + 1);
		}

		const forecast = await this.helpers.httpRequest({
			method: "GET",
			url: OPEN_METEO_URL,
			json: true,
		});

		const targetHour = new Date(targetDate);
		targetHour.setHours(6, 0, 0, 0);
		const targetStr = targetHour.toISOString().slice(0, 13);

		let windSpeed, windDir;
		forecast.hourly.time.forEach((time, i) => {
			if (time.startsWith(targetStr)) {
				windSpeed = forecast.hourly.wind_speed_10m[i];
				windDir = forecast.hourly.wind_direction_10m[i];
			}
		});

		if (windSpeed === undefined) {
			await sendNotification.call(this, "❓ Could not retrieve 6 AM wind forecast.");
			return [{ json: { message: "No forecast data" } }];
		}

		const westerly = isWesterly(windSpeed, windDir);
		let runway;

		if (now.getHours() >= 22 || now.getHours() < 6) {
			runway = getNightRunway(targetDate, westerly);
		} else {
			runway = getRunwayForWeek(targetDate);
		}

		let msg;
		if (!westerly) {
			msg = "😴 No planes overhead — easterly ops expected.";
		} else {
			if (runway === "27L" || runway === "09R") {
				msg = `🔊 Planes likely overhead on southern runway (${runway}) — ${windSpeed.toFixed(1)} kt from ${windDir}°.`;
			} else {
				msg = `✅ Planes on northern runway (${runway}) — ${windSpeed.toFixed(1)} kt from ${windDir}°.`;
			}
		}

		if (now.getHours() === 6) {
			msg += " 🚨 Heavy arrivals on both runways between 06:00–07:00.";
		}

		await sendNotification.call(this, msg);

		return [{ json: { message: msg, runway, windSpeed, windDir, westerly } }];

	} catch (e) {
		const errMsg = `⚠️ Error in plane forecast: ${e.message || e}`;
		await sendNotification.call(this, errMsg);
		return [{ json: { error: errMsg } }];
	}
}

return main.call(this);
